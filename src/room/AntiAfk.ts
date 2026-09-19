// AntiAfk — detecta jogadores parados (sem se mexer e sem falar no chat).
//
// Sinais de atividade:
//   - `chat-message`  → mensagem no chat (Socket.IO)
//   - `peer-input`    → frame de input do jogador via WebRTC (um por tecla apertada/solta;
//                       jogador parado não envia nada — ver BONK_PROTOCOL.md)
//
// Só vigia quem está num time (team > 0) durante uma partida; espectadores e o
// próprio bot são ignorados. Uso público: `room.enableAntiAfk()` / `room.isAfk(id)`.

import type { BonkRoom } from './BonkRoom.js';

/** Tempo sem movimento nem chat para considerar o jogador AFK. */
export const AFK_THRESHOLD_MS = 12_000;

export interface AntiAfkOptions {
  /** Default: 12000 ms. */
  thresholdMs?: number;
  /** Frequência da checagem que dispara `player-afk`. Default: 1000 ms. */
  checkIntervalMs?: number;
  /** Relógio injetável (testes). Default: Date.now. */
  now?: () => number;
}

export class AntiAfk {
  private readonly lastActivity = new Map<number, number>(); // playerId → timestamp
  private readonly flagged = new Set<number>(); // já avisados como AFK
  private readonly thresholdMs: number;
  private readonly now: () => number;
  private readonly timer: NodeJS.Timeout;
  private inGame = false;
  /** Última máscara de teclas de cada jogador (pacote 7): tecla segurada = jogando, mesmo sem novos eventos. */
  private readonly held = new Map<number, number>();

  constructor(private readonly room: BonkRoom, options: AntiAfkOptions = {}) {
    this.thresholdMs = options.thresholdMs ?? AFK_THRESHOLD_MS;
    this.now = options.now ?? Date.now;

    room.on('game-start', this.onGameStart);
    room.on('game-end', this.onGameEnd);
    room.on('player-leave', this.onLeave);
    room.on('team-change', this.onTeamChange);
    room.on('chat-message', this.onChat);
    room.on('peer-input', this.onInput);
    room.on('raw-packet', this.onRaw as never);

    this.timer = setInterval(this.check, options.checkIntervalMs ?? 1000);
    this.timer.unref();
  }

  /** true se o jogador é vigiado e está parado há pelo menos o threshold. */
  isAfk(playerId: number, at = this.now()): boolean {
    const last = this.lastActivity.get(playerId);
    return last !== undefined && at - last >= this.thresholdMs;
  }

  /** ms desde a última atividade; null se o jogador não é vigiado. */
  idleMs(playerId: number, at = this.now()): number | null {
    const last = this.lastActivity.get(playerId);
    return last === undefined ? null : at - last;
  }

  getAfkPlayers(at = this.now()): number[] {
    return [...this.lastActivity.keys()].filter((id) => this.isAfk(id, at));
  }

  dispose(): void {
    clearInterval(this.timer);
    this.room.off('game-start', this.onGameStart);
    this.room.off('game-end', this.onGameEnd);
    this.room.off('player-leave', this.onLeave);
    this.room.off('team-change', this.onTeamChange);
    this.room.off('chat-message', this.onChat);
    this.room.off('peer-input', this.onInput);
    this.room.off('raw-packet', this.onRaw as never);
    this.lastActivity.clear();
    this.flagged.clear();
    this.held.clear();
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private track(id: number, team: number): void {
    if (this.inGame && team > 0 && id !== this.room.state.myId && !this.lastActivity.has(id)) {
      this.lastActivity.set(id, this.now());
    }
  }

  private untrack(id: number): void {
    this.held.delete(id);
    this.lastActivity.delete(id);
    this.flagged.delete(id);
  }

  private markActive(id: number): void {
    if (!this.lastActivity.has(id)) return; // espectador / fora da partida
    this.lastActivity.set(id, this.now());
    if (this.flagged.delete(id)) this.room.emit('player-back', id);
  }

  /** Input de outro jogador pelo Socket.IO (`[7, id, {i, f, c}]`): mais confiável que o WebRTC. */
  private readonly onRaw = (pkt: { type: string; raw?: unknown[] }): void => {
    if (pkt.type !== 'UNKNOWN' || !pkt.raw || pkt.raw[0] !== 7) return;
    const id = pkt.raw[1];
    if (typeof id !== 'number') return;
    const data = pkt.raw[2] as { i?: number } | undefined;
    this.held.set(id, typeof data?.i === 'number' ? data.i : 0);
    this.markActive(id);
  };

  private readonly check = (): void => {
    for (const [id, keys] of this.held) if (keys !== 0) this.markActive(id);
    for (const id of this.getAfkPlayers()) {
      if (this.flagged.has(id)) continue;
      this.flagged.add(id);
      this.room.emit('player-afk', id);
    }
  };

  private readonly onGameStart = (): void => {
    this.inGame = true;
    this.held.clear();
    this.lastActivity.clear();
    this.flagged.clear();
    for (const p of this.room.state.players.values()) this.track(p.id, p.team);
  };

  private readonly onGameEnd = (): void => {
    this.inGame = false;
    this.lastActivity.clear();
    this.flagged.clear();
  };

  private readonly onLeave = (pkt: { id: number }): void => this.untrack(pkt.id);

  private readonly onTeamChange = (pkt: { id: number; team: number }): void => {
    if (pkt.team > 0) this.track(pkt.id, pkt.team);
    else this.untrack(pkt.id);
  };

  private readonly onChat = (pkt: { id: number }): void => this.markActive(pkt.id);

  private readonly onInput = (ev: { playerId: number }): void => this.markActive(ev.playerId);
}
