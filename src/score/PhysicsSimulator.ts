import { EventEmitter } from 'eventemitter3';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { ensureClientFiles } from './clientFiles.js';
import { simWorkerOptions } from './simSandbox.js';
import { SIM_WORKER_SOURCE } from './simWorker.js';

export interface PhysicsSimulatorOptions {
  /**
   * Pasta onde guardar os arquivos do client baixados do bonk.io. Eles não fazem parte deste pacote
   * (são do jogo) e são baixados na primeira execução.
   * Padrão: `<tmp>/bonktools-client`.
   */
  cacheDir?: string;
  /** Base de download dos arquivos do client. Padrão: `https://bonk.io/js/`. */
  clientBaseUrl?: string;
}

/** Jogador de football pela ótica do `createNewState` do jogo (indexado pelo id no array de entrada). */
export interface PhysicsPlayerSpec {
  id: number;
  team: number;
}

export interface BodyOverride {
  x?: number;
  y?: number;
  xv?: number;
  yv?: number;
}

/**
 * Alterações aplicadas ao estado inicial antes da partida começar — posições/velocidades da bola e
 * dos jogadores (por id) e `ftu` (quadros de congelamento inicial; 0 = começa já valendo). Útil para
 * treino de RL com posições iniciais aleatórias.
 */
export interface PhysicsStateOverrides {
  ball?: BodyOverride;
  discs?: Record<number, BodyOverride>;
  ftu?: number;
}

function applyBody(target: unknown, o: BodyOverride): void {
  if (!target || typeof target !== 'object') return;
  const t = target as Record<string, unknown>;
  for (const k of ['x', 'y', 'xv', 'yv'] as const) {
    if (typeof o[k] === 'number' && Number.isFinite(o[k])) t[k] = o[k];
  }
}

function applyOverrides(state: Record<string, unknown>, o: PhysicsStateOverrides): void {
  if (o.ball) applyBody(state['ball'], o.ball);
  const discs = state['discs'];
  if (o.discs && Array.isArray(discs)) {
    for (const [id, body] of Object.entries(o.discs)) applyBody(discs[Number(id)], body);
  }
  if (typeof o.ftu === 'number') state['ftu'] = o.ftu;
}

export interface StepGoal {
  team: number;
  scores: number[];
  frame: number;
}

export interface StepResult {
  /** Estado completo devolvido pelo client (posições/velocidades de jogadores e discos, placar, etc). */
  state: unknown;
  frame: number;
  /** Gols marcados neste quadro (comparado ao maior placar já visto). */
  goals: StepGoal[];
}

export interface PhysicsSimulatorEvents {
  ready: [];
  error: [error: Error];
}

/**
 * Simulador de física de football do bonk.io **standalone** — sem depender de uma `BonkRoom`/socket ao
 * vivo. Roda a física do próprio client do jogo (baixada de bonk.io na primeira execução) num worker
 * isolado, igual ao `ScoreTracker`, mas pensado para treino offline (RL): `reset()` cria uma partida e
 * `step(actions)` avança exatamente 1 quadro sob controle total do chamador, sem fila de eventos nem
 * rollback (esses mecanismos do `ScoreTracker` existem só para absorver o atraso de rede de partidas
 * ao vivo — aqui não há rede, cada quadro é decidido explicitamente).
 *
 * Experimental: depende de trechos do código ofuscado do client. Se o jogo mudar, `start()`/`reset()`
 * rejeitam e o simulador fica inutilizável (crie uma instância nova depois de corrigido).
 *
 * ```ts
 * const sim = new PhysicsSimulator();
 * await sim.start();
 * await sim.reset([null, { id: 1, team: 3 }, { id: 2, team: 2 }]);
 * const { state, goals } = await sim.step({ 1: 0b000010, 2: 0 }); // jogador 1 anda pra direita
 * sim.close();
 * ```
 */
export class PhysicsSimulator extends EventEmitter<PhysicsSimulatorEvents> {
  private worker: Worker | null = null;
  private _ready = false;
  private failed = false;
  private nextReq = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private readonly cacheDir: string;
  private readonly baseUrl: string;

  constructor(opts: PhysicsSimulatorOptions = {}) {
    super();
    this.cacheDir = opts.cacheDir ?? path.join(os.tmpdir(), 'bonktools-client');
    this.baseUrl = (opts.clientBaseUrl ?? 'https://bonk.io/js/').replace(/\/?$/, '/');
  }

  /** True quando o simulador carregou e está pronto para `reset()`/`step()`. */
  get ready(): boolean {
    return this._ready && !this.failed;
  }

  /** Baixa (se preciso) os arquivos do client e sobe o worker. Resolve quando estiver pronto. */
  async start(): Promise<void> {
    await ensureClientFiles(this.cacheDir, this.baseUrl);
    const worker = new Worker(SIM_WORKER_SOURCE, simWorkerOptions(this.cacheDir));
    this.worker = worker;
    worker.on('message', (m: { type: string; [k: string]: unknown }) => this.onWorker(m));
    worker.on('error', (e) => this.fail(e));
    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        this.off('ready', onReady);
        this.off('error', onErr);
      };
      const onReady = (): void => {
        cleanup();
        resolve();
      };
      const onErr = (e: Error): void => {
        cleanup();
        reject(e);
      };
      this.once('ready', onReady);
      this.once('error', onErr);
    });
  }

  /**
   * Cria uma partida nova (via `createNewState` do próprio jogo, sem depender de blobs capturados) e a
   * inicia no simulador. `players` é indexado pelo **id** do jogador (mesma convenção de
   * `ScoreTracker.buildInitialState`) — posições vazias viram `null`, ex.: `[null, {id:1,team:3}, {id:2,team:2}]`
   * para os ids 1 e 2. Devolve o estado inicial.
   */
  async reset(
    players: ReadonlyArray<PhysicsPlayerSpec | null>,
    seed = Math.floor(Math.random() * 1000),
    gs: Record<string, unknown> = { ga: 'f', wl: 0 },
    overrides?: PhysicsStateOverrides,
  ): Promise<unknown> {
    if (!this.ready || !this.worker) throw new Error('simulador não está pronto — chame start() primeiro');
    const state = await this.request<Record<string, unknown>>('create', { players: Array.from(players, (p) => p ?? null), seed });
    if (overrides) applyOverrides(state, overrides);
    this.worker.postMessage({ type: 'start', state, gs });
    return state;
  }

  /**
   * Avança `frames` quadros (padrão 1) com o mesmo input segurado. `actions` é o bitmask de input
   * (`left=1, right=2, up=4, down=8, action=16, action2=32`) por id de jogador — mesmo formato dos
   * pacotes `[7, id, {i,f,c}]` do jogo. `goals` junta os gols de todos os quadros avançados.
   */
  async step(actions: Record<number, number>, frames = 1): Promise<StepResult> {
    if (!this.ready || !this.worker) throw new Error('simulador não está pronto — chame reset() primeiro');
    return this.request<StepResult>('step', { actions, frames });
  }

  /** Encerra o worker. Idempotente. */
  close(): void {
    void this.worker?.terminate();
    this.worker = null;
    this._ready = false;
    for (const { reject } of this.pending.values()) reject(new Error('simulador encerrado'));
    this.pending.clear();
  }

  private request<T>(type: string, payload: Record<string, unknown>): Promise<T> {
    if (!this.worker) return Promise.reject(new Error('worker não iniciado'));
    const reqId = this.nextReq++;
    const worker = this.worker;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ type, reqId, ...payload });
    });
  }

  private onWorker(m: { type: string; [k: string]: unknown }): void {
    if (m.type === 'ready') {
      this._ready = true;
      this.emit('ready');
    } else if (m.type === 'created' || m.type === 'stepped') {
      const reqId = m['reqId'] as number;
      const entry = this.pending.get(reqId);
      this.pending.delete(reqId);
      entry?.resolve(m.type === 'created' ? m['state'] : m['result']);
    } else if (m.type === 'error') {
      this.fail(new Error(String(m['message'])));
    }
  }

  private fail(error: Error): void {
    this.failed = true;
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
    this.emit('error', error);
  }
}
