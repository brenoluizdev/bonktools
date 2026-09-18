import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { AntiAfk } from '../src/room/AntiAfk.js';
import type { BonkRoom } from '../src/room/BonkRoom.js';

const S = 1000;

function makeRoom(): { room: BonkRoom; bus: EventEmitter; players: Map<number, { id: number; team: number }> } {
  const bus = new EventEmitter();
  const players = new Map([
    [0, { id: 0, team: 0 }], // bot (myId)
    [1, { id: 1, team: 2 }],
    [2, { id: 2, team: 3 }],
    [3, { id: 3, team: 3 }],
    [4, { id: 4, team: 0 }], // espectador
  ]);
  const room = {
    state: { myId: 0, players },
    on: (e: string, h: (...a: unknown[]) => void) => bus.on(e, h),
    off: (e: string, h: (...a: unknown[]) => void) => bus.off(e, h),
    emit: (e: string, ...a: unknown[]) => bus.emit(e, ...a),
  } as unknown as BonkRoom;
  return { room, bus, players };
}

describe('AntiAfk', () => {
  let clock = 0;
  let room: BonkRoom;
  let bus: EventEmitter;
  let afk: AntiAfk;
  const afkEvents: number[] = [];
  const backEvents: number[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    clock = 0;
    afkEvents.length = 0;
    backEvents.length = 0;
    ({ room, bus } = makeRoom());
    bus.on('player-afk', (id: number) => afkEvents.push(id));
    bus.on('player-back', (id: number) => backEvents.push(id));
    afk = new AntiAfk(room, { now: () => clock, checkIntervalMs: 100 });
    bus.emit('game-start');
  });

  afterEach(() => {
    afk.dispose();
    vi.useRealTimers();
  });

  const advance = (ms: number): void => {
    clock += ms;
    vi.advanceTimersByTime(ms);
  };

  it('11,9 s parado não é AFK; 12 s exatos é', () => {
    clock = 11_900;
    expect(afk.isAfk(1)).toBe(false);
    clock = 12 * S;
    expect(afk.isAfk(1)).toBe(true);
  });

  it('só vigia jogadores em time: bot e espectador nunca são AFK', () => {
    clock = 60 * S;
    expect(afk.isAfk(0)).toBe(false);
    expect(afk.isAfk(4)).toBe(false);
    expect(afk.idleMs(4)).toBeNull();
    expect(afk.getAfkPlayers()).toEqual([1, 2, 3]);
  });

  it('movimento (peer-input) zera o relógio', () => {
    clock = 10 * S;
    bus.emit('peer-input', { playerId: 1 });
    clock = 21 * S;
    expect(afk.isAfk(1)).toBe(false);
    clock = 22 * S;
    expect(afk.isAfk(1)).toBe(true);
  });

  it('mensagem no chat zera o relógio', () => {
    clock = 11 * S;
    bus.emit('chat-message', { id: 2 });
    clock = 20 * S;
    expect(afk.isAfk(2)).toBe(false);
    clock = 23 * S;
    expect(afk.isAfk(2)).toBe(true);
  });

  it('jogadores são independentes', () => {
    clock = 8 * S;
    bus.emit('peer-input', { playerId: 2 });
    clock = 13 * S;
    expect(afk.getAfkPlayers()).toEqual([1, 3]);
    expect(afk.idleMs(2)).toBe(5 * S);
  });

  it('emite player-afk uma única vez e player-back ao voltar', () => {
    advance(12 * S);
    expect(afkEvents).toEqual([1, 2, 3]);
    advance(5 * S);
    expect(afkEvents).toEqual([1, 2, 3]); // sem repetir

    bus.emit('peer-input', { playerId: 1 });
    expect(backEvents).toEqual([1]);
    expect(afk.isAfk(1)).toBe(false);

    advance(12 * S); // parou de novo → avisa outra vez
    expect(afkEvents.filter((id) => id === 1)).toHaveLength(2);
  });

  it('sair da partida / trocar para espectador para de vigiar; game-end limpa tudo', () => {
    bus.emit('player-leave', { id: 2 });
    expect(afk.idleMs(2)).toBeNull();
    bus.emit('team-change', { id: 3, team: 0 });
    expect(afk.idleMs(3)).toBeNull();
    bus.emit('game-end');
    expect(afk.getAfkPlayers()).toEqual([]);
  });

  it('dispose remove os listeners', () => {
    afk.dispose();
    expect(bus.listenerCount('peer-input')).toBe(0);
    expect(bus.listenerCount('chat-message')).toBe(0);
  });
});
