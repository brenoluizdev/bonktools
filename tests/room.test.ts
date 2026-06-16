import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Wave 0 scaffold — imports FALHAM até o plano 02-02 criar BonkRoom.ts.
// Esperado e correto (Nyquist: testes RED antes da implementação).
import { BonkRoom } from '../src/room/BonkRoom.js';
import pino from 'pino';

// MockTransport: substitui BonkTransport nos testes de unidade.
// BonkRoom aceita transport injetado para permitir substituição em testes.
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
  mode: 0,
  rounds: 3,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BonkRoom — evento raw-packet (D-06)', () => {
  it('emite raw-packet para todo packet recebido, incluindo UNKNOWN', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
    });
    const received: unknown[] = [];
    room.on('raw-packet', (p) => received.push(p));

    // Simular packet UNKNOWN via método privado (packet id desconhecido = 99)
    room['handleIncomingPacket']([99, 'dados_desconhecidos']);

    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe('UNKNOWN');
  });
});

describe('BonkRoom — evento tipado player-join (OBS-01)', () => {
  it('emite player-join com payload correto ao receber packet 4', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
    });
    const receivedJoins: unknown[] = [];
    room.on('player-join', (p) => receivedJoins.push(p));

    // Packet 4: PLAYER_JOIN com campos obrigatórios
    room['handleIncomingPacket']([
      4,
      2,
      'def456v00000',
      'NewPlayer',
      true,
      0,
      5,
      false,
      false,
      { layers: [], bc: 0 },
    ]);

    expect(receivedJoins).toHaveLength(1);
    const payload = receivedJoins[0] as { type: string; userName: string };
    expect(payload.type).toBe('PLAYER_JOIN');
    expect(payload.userName).toBe('NewPlayer');
  });
});

describe('BonkRoom — evento room-dead (D-07)', () => {
  it('emite room-dead com kind socket-disconnect quando transport disconnecta', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
      reconnectPolicy: { maxAttempts: 0 }, // sem retry para simplificar o teste
    });
    const deadEvents: unknown[] = [];
    room.on('room-dead', (reason) => deadEvents.push(reason));

    // Simular disconnect do transport (evento 'disconnect' do socket)
    room['handleTransportDisconnect']('io server disconnect');

    expect(deadEvents).toHaveLength(1);
    const reason = deadEvents[0] as { kind: string };
    expect(reason.kind).toBe('socket-disconnect');
  });
});

describe('BonkRoom — evento room-rebuilt (D-07)', () => {
  it('emite room-rebuilt após sequência dead → rebuild → packet 49 (SHARE_LINK)', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
    });
    const rebuiltEvents: unknown[] = [];
    room.on('room-rebuilt', (shareLink) => rebuiltEvents.push(shareLink));

    // Simular packet 49: SHARE_LINK — indica que a nova sala está pronta
    room['handleIncomingPacket']([49, 261254, 'newbypass']);

    // Avançar timers para processar eventos assíncronos de rebuild se necessário
    vi.runAllTimers();

    expect(rebuiltEvents).toHaveLength(1);
    // O share link deve conter o bypass da nova sala
    expect(String(rebuiltEvents[0])).toContain('newbypass');
  });
});

describe('BonkRoom.state.players — Map após packet 3 (JOIN_ROOM)', () => {
  it('state.players é um Map populado após receber packet 3', () => {
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger: SILENT_LOGGER,
      transport,
    });

    // Packet 3: JOIN_ROOM — snapshot autoritativo do roster
    // args: myId, hostId, players[], timestamp, teamsLocked, roomId, roomBypass
    room['handleIncomingPacket']([
      3,
      0,
      0,
      [
        null,
        {
          peerID: 'abc123v00000',
          userName: 'TestBot',
          guest: false,
          team: 1,
          level: 10,
          ready: false,
          tabbed: false,
          avatar: { layers: [], bc: 0 },
        },
      ],
      1718000000000,
      false,
      12345,
      'agsey',
    ]);

    expect(room.state.players).toBeInstanceOf(Map);
    // null no índice 0 deve ser ignorado; índice 1 deve ser mapeado
    expect(room.state.players.has(0)).toBe(false);
    expect(room.state.players.has(1)).toBe(true);
  });
});

describe('BonkRoom — logger pino warn em zod failure (OBS-03)', () => {
  it('chama logger.warn quando packet falha na validação zod', () => {
    const logger = pino({ level: 'silent' });
    const warnSpy = vi.spyOn(logger, 'warn');
    const transport = makeMockTransport();
    const room = new BonkRoom({
      desiredState: DESIRED_STATE_FIXTURE,
      logger,
      transport,
    });

    // Packet 3 com dados malformados (string onde deveria ser número) → falha zod
    room['handleIncomingPacket']([3, 'dados_invalidos']);

    expect(warnSpy).toHaveBeenCalled();
  });
});
