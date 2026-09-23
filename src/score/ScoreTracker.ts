import { EventEmitter } from 'eventemitter3';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { decodeInitialState, encodeInitialState } from '../codec/initialState.js';
import type { GameStartPacket } from '../codec/packets.js';
import type { BonkRoom } from '../room/BonkRoom.js';
import { ensureClientFiles } from './clientFiles.js';
import { simWorkerOptions } from './simSandbox.js';
import { SIM_WORKER_SOURCE } from './simWorker.js';

/** Times que pontuam no football (ids de time do bonk.io). */
const SCORING_TEAMS = [2, 3, 4, 5] as const;

export interface ScoreTrackerOptions {
  /**
   * Pasta onde guardar os arquivos do client baixados do bonk.io. Eles não fazem parte deste pacote
   * (são do jogo) e são baixados na primeira execução.
   * Padrão: `<tmp>/bonktools-client`.
   */
  cacheDir?: string;
  /** Base de download dos arquivos do client. Padrão: `https://bonk.io/js/`. */
  clientBaseUrl?: string;
  /** Pontos para vencer. Padrão: `gs.wl` da partida (os "rounds" da sala). */
  maxScore?: number;
  /** Intervalo de avanço da simulação, em ms. Padrão: 100. */
  tickMs?: number;
  /** Quantos frames a simulação fica atrás do relógio, para os inputs chegarem. Padrão: 6 (200 ms). */
  lagFrames?: number;
}

export interface ScoreInfo {
  /** Time que pontuou (2 vermelho, 3 azul...). */
  team: number;
  /** Placar de todos os times, indexado pelo id do time. */
  scores: number[];
  /** Frame da partida em que o ponto saiu. */
  frame: number;
}

export interface MatchWinnerInfo {
  team: number;
  scores: number[];
  frame: number;
}

/** Estado físico completo da partida rastreada, emitido a cada tick (ver `ScoreTrackerOptions.tickMs`). */
export interface StateInfo {
  state: unknown;
  frame: number;
}

export interface ScoreTrackerEvents {
  /** Simulador carregado. */
  ready: [];
  /** Um time fez ponto. */
  score: [info: ScoreInfo];
  /** Um time chegou ao limite de pontos (`maxScore`/`gs.wl`). Emitido uma vez por partida. */
  'match-winner': [info: MatchWinnerInfo];
  /**
   * Estado físico completo (bola, discos, placar...) a cada tick da partida ativa — pra quem precisa
   * de mais que só o placar (ex.: alimentar uma política de RL em tempo real).
   */
  state: [info: StateInfo];
  /** Falha ao carregar ou simular (ex.: o client do jogo mudou). O rastreamento é desativado. */
  error: [error: Error];
}

/** Time que atingiu o limite de pontos, ou null. Em empate no mesmo frame, o de menor id. */
export function winnerOf(scores: readonly number[], maxScore: number): number | null {
  for (const team of SCORING_TEAMS) if ((scores[team] ?? 0) >= maxScore) return team;
  return null;
}

/**
 * Descobre o placar de partidas de **football** sem navegador.
 *
 * O bonk.io não informa placar nem vencedor ao host por pacote nenhum. O `ScoreTracker` roda a física do
 * próprio client do jogo (baixada de bonk.io na primeira execução) num worker, alimentada com o estado
 * inicial da partida (`GAME_START`) e com os inputs dos jogadores (`[7, id, {i, f, c}]`). Como o jogo é
 * determinístico, o resultado é idêntico ao dos clientes.
 *
 * Experimental: depende de trechos do código ofuscado do client. Se o jogo mudar, emite `error` e para.
 *
 * ```ts
 * const score = new ScoreTracker(room);
 * score.on('score', ({ team, scores }) => room.chat(`ponto do time ${team}`));
 * score.on('match-winner', ({ team }) => console.log('venceu', team));
 * await score.start();
 * ```
 */
export class ScoreTracker extends EventEmitter<ScoreTrackerEvents> {
  private worker: Worker | null = null;
  private _ready = false;
  private failed = false;
  private timer: NodeJS.Timeout | null = null;
  private startedAt = 0;
  private active = false;
  private maxScore = 0;
  private decided = false;
  private nextReq = 1;
  private readonly pending = new Map<number, (state: unknown) => void>();
  private readonly cacheDir: string;
  private readonly baseUrl: string;
  private readonly tickMs: number;
  private readonly lagFrames: number;
  private readonly onGameStart = (pkt: GameStartPacket) => this.beginMatch(pkt.is ?? null, pkt.gs);
  private readonly onGameEnd = () => this.endMatch();
  private readonly onRaw = (pkt: { type: string; raw?: unknown[] }) => this.handleRaw(pkt);

  constructor(private readonly room: BonkRoom, private readonly opts: ScoreTrackerOptions = {}) {
    super();
    this.cacheDir = opts.cacheDir ?? path.join(os.tmpdir(), 'bonktools-client');
    this.baseUrl = (opts.clientBaseUrl ?? 'https://bonk.io/js/').replace(/\/?$/, '/');
    this.tickMs = opts.tickMs ?? 100;
    this.lagFrames = opts.lagFrames ?? 6;
  }

  /** True quando o simulador carregou e a partida atual está sendo acompanhada. */
  get tracking(): boolean {
    return this._ready && !this.failed && this.active;
  }

  /** True quando o simulador está pronto (independe de haver partida). */
  get ready(): boolean {
    return this._ready && !this.failed;
  }

  async start(): Promise<void> {
    try {
      await ensureClientFiles(this.cacheDir, this.baseUrl);
    } catch (e) {
      this.fail(e as Error);
      return;
    }
    const worker = new Worker(SIM_WORKER_SOURCE, simWorkerOptions(this.cacheDir));
    this.worker = worker;
    worker.on('message', (m: { type: string; [k: string]: unknown }) => this.onWorker(m));
    worker.on('error', (e) => this.fail(e));

    this.room.on('game-start', this.onGameStart);
    this.room.on('game-end', this.onGameEnd);
    this.room.on('raw-packet', this.onRaw as never);
  }

  /**
   * Gera o IS blob de uma partida de football para os jogadores dados, usando o próprio código do jogo
   * (`createNewState`). Não depende de blobs capturados: vale para qualquer quantidade de jogadores e
   * para qualquer id. `players` é indexado pelo id do jogador; só os times 2 (vermelho) e 3 (azul) ganham disco.
   * Devolve null se o simulador não está pronto.
   */
  buildInitialState(players: ReadonlyArray<{ id: number; team: number } | null>, seed = Math.floor(Math.random() * 1000)): Promise<string | null> {
    if (!this.ready || !this.worker) return Promise.resolve(null);
    const reqId = this.nextReq++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(reqId); resolve(null); }, 3000);
      this.pending.set(reqId, (state) => {
        clearTimeout(timer);
        try {
          const st = state as { players?: unknown[]; discs?: unknown[] };
          // arrays esparsos (posições vazias) viram null, como no blob do jogo
          if (Array.isArray(st.players)) st.players = Array.from(st.players, (p) => p ?? null);
          if (Array.isArray(st.discs)) st.discs = Array.from(st.discs, (d) => d ?? null);
          resolve(encodeInitialState(st as never));
        } catch {
          resolve(null);
        }
      });
      this.worker!.postMessage({ type: 'create', reqId, players: Array.from(players, (p) => p ?? null), seed });
    });
  }

  /**
   * Injeta manualmente, na simulação local, um input que O PRÓPRIO HOST mandou (via
   * `BonkRoom.sendInput`). O servidor não ecoa de volta pro remetente o pacote de input que ele mesmo
   * enviou (só retransmite pros outros clientes) — sem isso, `handleRaw` (que só escuta pacotes
   * RECEBIDOS do servidor) nunca vê o próprio input do host, e o disco dele fica congelado pra sempre
   * na simulação, mesmo o servidor aplicando o movimento normalmente pros outros jogadores.
   */
  recordOwnInput(playerId: number, i: number, f: number, c = 0): void {
    if (!this.active) return;
    this.worker?.postMessage({ type: 'input', id: playerId, i, f, c });
  }

  stop(): void {
    this.endMatch();
    this.room.off('game-start', this.onGameStart);
    this.room.off('game-end', this.onGameEnd);
    this.room.off('raw-packet', this.onRaw as never);
    void this.worker?.terminate();
    this.worker = null;
    this._ready = false;
  }

  private fail(error: Error): void {
    this.failed = true;
    this.endMatch();
    this.emit('error', error);
  }

  private onWorker(m: { type: string; [k: string]: unknown }): void {
    if (m.type === 'ready') {
      this._ready = true;
      this.emit('ready');
    } else if (m.type === 'created') {
      const done = this.pending.get(m['reqId'] as number);
      this.pending.delete(m['reqId'] as number);
      done?.(m['state']);
    } else if (m.type === 'error') {
      this.fail(new Error(String(m['message'])));
    } else if (m.type === 'goal' && this.active && !this.decided) {
      const info: ScoreInfo = { team: m['team'] as number, scores: m['scores'] as number[], frame: m['frame'] as number };
      this.emit('score', info);
      if (!this.decided) {
        const winner = winnerOf(info.scores, this.maxScore);
        if (winner !== null) {
          this.decided = true;
          this.emit('match-winner', { team: winner, scores: info.scores, frame: info.frame });
        }
      }
    } else if (m.type === 'tickState' && this.active) {
      if (m['state'] != null) this.emit('state', { state: m['state'], frame: m['frame'] as number });
    }
  }

  private beginMatch(is: string | null, gs: unknown): void {
    this.endMatch();
    if (!this._ready || this.failed || !is) return;
    const settings = (gs ?? {}) as { ga?: string; wl?: number };
    if (settings.ga !== 'f') return; // só football
    let state;
    try {
      state = decodeInitialState(is);
    } catch (e) {
      this.fail(e as Error);
      return;
    }
    this.maxScore = this.opts.maxScore ?? (typeof settings.wl === 'number' && settings.wl > 0 ? settings.wl : 3);
    this.decided = false;
    this.active = true;
    this.startedAt = Date.now();
    this.worker?.postMessage({ type: 'start', state, gs });
    this.timer = setInterval(() => {
      const target = Math.floor(((Date.now() - this.startedAt) * 30) / 1000) - this.lagFrames;
      if (target > 0) this.worker?.postMessage({ type: 'tick', target });
    }, this.tickMs);
  }

  private endMatch(): void {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.worker?.postMessage({ type: 'stop' });
  }

  private handleRaw(pkt: { type: string; raw?: unknown[] }): void {
    if (!this.active || pkt.type !== 'UNKNOWN' || !pkt.raw) return;
    const [id, playerId, data] = pkt.raw as [number, number, { i?: number; f?: number; c?: number } | undefined];
    if (id !== 7 || typeof playerId !== 'number' || !data || typeof data.i !== 'number' || typeof data.f !== 'number') return;
    this.worker?.postMessage({ type: 'input', id: playerId, i: data.i, f: data.f, c: data.c ?? 0 });
  }
}
