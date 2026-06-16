import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Wave 0 scaffold — imports de factories FALHAM até a Wave 3 criar factories.ts.
// Esperado e correto (Nyquist: testes RED antes da implementação).
import { BonkRoom } from '../src/room/BonkRoom.js';
import pino from 'pino';

// Imports que causam RED: factories.ts ainda não existe (Wave 3).
import { createRoom, joinRoom } from '../src/room/factories.js';

// Tipos / classes de erro Phase 3 (RoomCreationTimeoutError é classe — uso em runtime).
import type {
  CreateRoomOptions,
  JoinRoomOptions,
  ResolvedRoomAddress,
} from '../src/room/types.js';
import { RoomCreationTimeoutError } from '../src/room/types.js';

// ─── MockTransport (igual ao padrão de room.test.ts) ──────────────────────────

interface MockTransport {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  sendPacket: ReturnType<typeof vi.fn>;
  getState: ReturnType<typeof vi.fn>;
}

function makeMockTransport(): MockTransport {
  return {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendPacket: vi.fn(),
    getState: vi.fn().mockReturnValue('connected'),
  };
}

const SILENT_LOGGER = pino({ level: 'silent' });

// Fixture mínima de desiredState para criar um BonkRoom em testes.
const DESIRED_STATE_FIXTURE = {
  roomName: 'TestRoom',
  password: '',
  maxPlayers: 6,
  mode: 'b',
  rounds: 3,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Stub 1: createRoom resolve com shareLink (ROOM-01) ───────────────────────

describe('createRoom — retorna instância com shareLink (ROOM-01)', () => {
  it('factory createRoom resolve com BonkRoom pronto após packet 49', async () => {
    const transport = makeMockTransport();
    // MockTransport que emite packet 49 [49, roomId, bypass] no connect.
    transport.connect.mockImplementation(() => {
      // dispara o handler 'packet' registrado pelo BonkRoom com o SHARE_LINK
      const handler = transport.on.mock.calls.find((c) => c[0] === 'packet')?.[1];
      handler?.([49, 261254, 'agsey']);
      return Promise.resolve();
    });

    const options: CreateRoomOptions = {
      auth: { type: 'guest', guestName: 'Bot' },
      desiredState: DESIRED_STATE_FIXTURE,
      timeoutMs: 1000,
    };

    const room = await createRoom({ ...options, transport });
    expect(room.shareLink).toBe('https://bonk.io/261254agsey');
  });
});

// ─── Stub 2: createRoom timeout (D-04) ────────────────────────────────────────

describe('createRoom — RoomCreationTimeoutError (D-04)', () => {
  it('rejeita com RoomCreationTimeoutError se packet 49 não chega no timeout', async () => {
    const transport = makeMockTransport();
    // Nunca emite packet 49 → deve estourar o timeout.

    const options: CreateRoomOptions = {
      auth: { type: 'guest', guestName: 'Bot' },
      desiredState: DESIRED_STATE_FIXTURE,
      timeoutMs: 50,
    };

    const promise = createRoom({ ...options, transport });
    // avançar timers para disparar o timeout
    await vi.advanceTimersByTimeAsync(60);

    await expect(promise).rejects.toThrowError(RoomCreationTimeoutError);
    await expect(promise).rejects.toHaveProperty('name', 'RoomCreationTimeoutError');
  });
});

// ─── Stub 3: joinRoom resolve após packet 3 (ROOM-02) ─────────────────────────

describe('joinRoom — resolve após packet 3 (ROOM-02)', () => {
  it('factory joinRoom resolve com BonkRoom pronto após receber ROOM_JOIN', async () => {
    const transport = makeMockTransport();
    transport.connect.mockImplementation(() => {
      const handler = transport.on.mock.calls.find((c) => c[0] === 'packet')?.[1];
      // packet 3: myId, hostId, players[], timestamp, teamsLocked, roomId, roomBypass
      handler?.([3, 0, 0, [], 1718000000000, false, 12345, 'agsey']);
      return Promise.resolve();
    });

    const address: ResolvedRoomAddress = {
      server: 'b2seattle1',
      joinId: 'someJoinId',
      bypass: 'agsey',
    };

    const options: JoinRoomOptions = {
      auth: { type: 'guest', guestName: 'Bot' },
      timeoutMs: 1000,
    };

    const room = await joinRoom(address, { ...options, transport });
    expect(room.state.myId).toBe(0);
  });
});

// ─── Stub 4: BonkRoom.shareLink getter (D-05) ─────────────────────────────────

describe('BonkRoom.shareLink — getter público (D-05)', () => {
  it('shareLink retorna null antes de conectar e URL completa após packet 49', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
    });

    expect(room.shareLink).toBeNull();

    room['handleIncomingPacket']([49, 261254, 'agsey']);

    expect(room.shareLink).toBe('https://bonk.io/261254agsey');
  });
});

// ─── Stub 5: BonkRoom.setRoomName fire-and-forget (D-09) ──────────────────────

describe('BonkRoom.setRoomName — fire-and-forget (D-09)', () => {
  it('setRoomName envia packet 52 com newName e atualiza desiredState', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: { ...DESIRED_STATE_FIXTURE },
      logger: SILENT_LOGGER,
      transport,
    });

    room.setRoomName('Nova Sala');

    expect(transport.sendPacket).toHaveBeenCalledWith(52, { newName: 'Nova Sala' });
    expect(room['desiredState'].roomName).toBe('Nova Sala');
  });
});

// ─── Stub 6: BonkRoom.setRoomPassword fire-and-forget (D-10) ──────────────────

describe('BonkRoom.setRoomPassword — fire-and-forget (D-10)', () => {
  it('setRoomPassword envia packet 53 com newPass e atualiza desiredState', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: { ...DESIRED_STATE_FIXTURE },
      logger: SILENT_LOGGER,
      transport,
    });

    room.setRoomPassword('senha123');

    expect(transport.sendPacket).toHaveBeenCalledWith(53, { newPass: 'senha123' });
    expect(room['desiredState'].password).toBe('senha123');
  });
});
