// BonkSession — testes de pool, reconcile loop híbrido, stagger e destroy (RM-01, RM-04, RM-05).
// Padrão: mockar createRoom (vi.mock) para retornar um BonkRoom stub sem rede.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const SILENT_LOGGER = pino({ level: 'silent' });

// ── Mock de createRoom: sem rede, retorna makeMockRoom() ─────────────────────────
// vi.hoisted permite referenciar makeMockRoom dentro do factory de vi.mock.
const { createRoomMock } = vi.hoisted(() => ({ createRoomMock: vi.fn() }));

vi.mock('../src/room/factories.js', () => ({
  createRoom: createRoomMock,
  joinRoom: vi.fn(),
}));

// Mock de AuthClient: BonkSession instancia um no constructor; evitar leitura de cert/rede.
vi.mock('../src/auth/AuthClient.js', () => ({
  AuthClient: class {
    getToken = vi.fn().mockResolvedValue('fake-token');
    generatePeerID = vi.fn().mockReturnValue('peer-123');
    discoverServer = vi.fn();
  },
}));

import { BonkSession } from '../src/session/BonkSession.js';
import type { RoomDeadReason } from '../src/room/types.js';

/**
 * MockRoom: simula um BonkRoom com EventEmitter3 stub.
 * Captura os handlers registrados via .on para permitir emissão manual de 'room-dead'.
 */
interface MockRoom {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  emitDead: (reason: RoomDeadReason) => void;
}

function makeMockRoom(): MockRoom {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    handlers.set(event, handler);
  });
  return {
    on,
    off: vi.fn(),
    once: vi.fn(),
    disconnect: vi.fn(),
    emitDead: (reason: RoomDeadReason): void => {
      handlers.get('room-dead')?.(reason);
    },
  };
}

const ROOM_CONFIG = { id: 'r1', name: 'Sala 1', maxPlayers: 6, mode: 'b', rounds: 3 };
const RECONCILE_INTERVAL_MS = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  createRoomMock.mockReset();
  createRoomMock.mockImplementation(async () => makeMockRoom());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeSession(): BonkSession {
  return new BonkSession({
    auth: { type: 'registered', username: 'u', password: 'p' },
    throttle: { capacity: 10, refillPerSec: 100 },
    logger: SILENT_LOGGER,
  });
}

describe('BonkSession — pool de salas (RM-01)', () => {
  it('addRoom cria sala no pool e retorna localId único', async () => {
    const session = makeSession();
    const id1 = await session.addRoom(ROOM_CONFIG);
    const id2 = await session.addRoom({ ...ROOM_CONFIG, id: 'r2', name: 'Sala 2' });

    expect(typeof id1).toBe('string');
    expect(id1).not.toBe(id2);
    expect(createRoomMock).toHaveBeenCalledTimes(2);
    expect(session.rooms.size).toBe(2);
    expect(session.rooms.get(id1)?.status).toBe('active');
  });

  it('removeRoom remove sala do pool e chama disconnect', async () => {
    const session = makeSession();
    const room = makeMockRoom();
    createRoomMock.mockResolvedValueOnce(room);

    const id = await session.addRoom(ROOM_CONFIG);
    expect(session.rooms.size).toBe(1);

    await session.removeRoom(id);

    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(session.rooms.size).toBe(0);
  });

  it('getter rooms reflete estado atual do pool como ReadonlyMap', async () => {
    const session = makeSession();
    const id = await session.addRoom(ROOM_CONFIG);

    const rooms = session.rooms;
    expect(rooms.has(id)).toBe(true);
    expect(rooms.get(id)?.status).toBe('active');
    expect(rooms.get(id)?.room).toBeDefined();
  });
});

describe('BonkSession — reconcile loop (RM-01, D-07, D-08)', () => {
  it('room-dead terminal → status dead-terminal, sem recriar (D-08)', async () => {
    const session = makeSession();
    const room = makeMockRoom();
    createRoomMock.mockResolvedValueOnce(room);

    const id = await session.addRoom(ROOM_CONFIG);

    const terminalEvents: unknown[] = [];
    session.on('room-dead-terminal', (p) => terminalEvents.push(p));

    createRoomMock.mockClear();
    room.emitDead({ kind: 'status-banned' });
    await vi.runAllTimersAsync();

    expect(session.rooms.get(id)?.status).toBe('dead-terminal');
    expect(terminalEvents).toHaveLength(1);
    expect(createRoomMock).not.toHaveBeenCalled();
  });

  it('room-dead não-terminal → scheduleRecreate com throttle', async () => {
    const session = makeSession();
    const room = makeMockRoom();
    createRoomMock.mockResolvedValueOnce(room);

    await session.addRoom(ROOM_CONFIG);

    createRoomMock.mockClear();
    createRoomMock.mockImplementation(async () => makeMockRoom());
    room.emitDead({ kind: 'socket-disconnect', cause: 'transport closed' });
    await vi.runAllTimersAsync();

    expect(createRoomMock).toHaveBeenCalledTimes(1);
  });

  it('timer de 60s detecta sala em estado inconsistente não emitida (D-07)', async () => {
    const session = makeSession();
    await session.startFromConfig({
      rooms: [ROOM_CONFIG],
      throttle: { maxConcurrentRooms: 3, roomCreationDelayMs: 0, roomCreationJitterMs: 0 },
    });

    createRoomMock.mockClear();
    createRoomMock.mockImplementation(async () => makeMockRoom());

    // Simular inconsistência: remover sala do pool sem disparar reconcile manual.
    const id = [...session.rooms.keys()][0]!;
    (session as unknown as { _rooms: Map<string, unknown> })._rooms.delete(id);

    // Avançar o timer de 60s → reconcile recria a sala faltante.
    await vi.advanceTimersByTimeAsync(RECONCILE_INTERVAL_MS);

    expect(createRoomMock).toHaveBeenCalled();

    await session.destroy();
  });
});

describe('BonkSession — destroy (RM-04)', () => {
  it('destroy() chama disconnect em todas as rooms do pool', async () => {
    const session = makeSession();
    const roomA = makeMockRoom();
    const roomB = makeMockRoom();
    createRoomMock.mockResolvedValueOnce(roomA).mockResolvedValueOnce(roomB);

    await session.addRoom(ROOM_CONFIG);
    await session.addRoom({ ...ROOM_CONFIG, id: 'r2' });

    await session.destroy();

    expect(roomA.disconnect).toHaveBeenCalledTimes(1);
    expect(roomB.disconnect).toHaveBeenCalledTimes(1);
    expect(session.rooms.size).toBe(0);
  });

  it('destroy() limpa o reconcile timer (sem handle leak)', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const session = makeSession();
    await session.startFromConfig({
      rooms: [ROOM_CONFIG],
      throttle: { maxConcurrentRooms: 3, roomCreationDelayMs: 0, roomCreationJitterMs: 0 },
    });

    await session.destroy();

    expect(clearSpy).toHaveBeenCalled();
  });

  it('destroy() idempotente — segunda chamada não lança', async () => {
    const session = makeSession();
    await session.addRoom(ROOM_CONFIG);

    await session.destroy();
    await expect(session.destroy()).resolves.toBeUndefined();
  });
});

describe('BonkSession — stagger/jitter (RM-05, D-09)', () => {
  it('startFromConfig aguarda delay+jitter entre criações de sala', async () => {
    const session = makeSession();
    createRoomMock.mockImplementation(async () => makeMockRoom());

    const promise = session.startFromConfig({
      rooms: [
        ROOM_CONFIG,
        { ...ROOM_CONFIG, id: 'r2', name: 'Sala 2' },
        { ...ROOM_CONFIG, id: 'r3', name: 'Sala 3' },
      ],
      throttle: { maxConcurrentRooms: 3, roomCreationDelayMs: 1000, roomCreationJitterMs: 0 },
    });

    // 3 salas, 2 delays de 1000ms entre elas — avançar cobre ambos sem tocar o interval de 60s.
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(createRoomMock).toHaveBeenCalledTimes(3);
    expect(session.rooms.size).toBe(3);

    await session.destroy();
  });
});
