import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';
import { BonkRoom } from '../src/room/BonkRoom.js';

function makeMockTransport() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    sendPacket: vi.fn(),
    getState: vi.fn().mockReturnValue('connected'),
  };
}

const DESIRED = { roomName: 'TestRoom', password: '', mode: 0, rounds: 3 };
const LOGGER = pino({ level: 'silent' });

function makeRoom() {
  const transport = makeMockTransport();
  const room = new BonkRoom({ desiredState: DESIRED, transport, logger: LOGGER });
  return { room, transport };
}

/** Host (id 0) numa sala criada. */
function asHost(room: BonkRoom): void {
  room['handleIncomingPacket']([2, 'sock', 0]); // ROOM_CREATED
}

/** Cliente comum (id 1, host é o 0) que entrou numa sala existente. */
function asGuest(room: BonkRoom): void {
  const player = (name: string) => ({
    peerID: `${name}v00000`, userName: name, guest: false, team: 1, level: 1, ready: false, tabbed: false, avatar: { layers: [], bc: 0 },
  });
  room['handleIncomingPacket']([3, 1, 0, [player('host'), player('me')], 1718000000000, false, 12345, 'agsey']);
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('lockTeams / unlockTeams', () => {
  it('lockTeams() envia packet 7 {teamLock:true} e marca state.teamsLocked', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    expect(transport.sendPacket).toHaveBeenCalledWith(7, { teamLock: true });
    expect(room.state.teamsLocked).toBe(true);
  });

  it('unlockTeams() envia packet 7 {teamLock:false} e desmarca state.teamsLocked', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room.unlockTeams();
    expect(transport.sendPacket).toHaveBeenLastCalledWith(7, { teamLock: false });
    expect(room.state.teamsLocked).toBe(false);
  });

  it('setTeamLock continua funcionando (compatibilidade)', () => {
    const { room, transport } = makeRoom();
    room.setTeamLock(true);
    expect(transport.sendPacket).toHaveBeenCalledWith(7, { teamLock: true });
  });

  it('quem não é host não consegue travar (nada é enviado, estado não muda)', () => {
    const { room, transport } = makeRoom();
    asGuest(room);
    room.lockTeams();
    expect(transport.sendPacket).not.toHaveBeenCalled();
    expect(room.state.teamsLocked).toBe(false);
  });

  it('sem transport conectado não quebra', () => {
    const room = new BonkRoom({ desiredState: DESIRED, logger: LOGGER });
    expect(() => room.lockTeams()).not.toThrow();
    expect(room.state.teamsLocked).toBe(false);
  });

  it('packet 19 recebido (outro host/servidor) atualiza state.teamsLocked e emite teamlock-toggle', () => {
    const { room } = makeRoom();
    asGuest(room);
    const seen: boolean[] = [];
    room.on('teamlock-toggle', (p) => seen.push(p.locked));
    room['handleIncomingPacket']([19, true]);
    expect(room.state.teamsLocked).toBe(true);
    room['handleIncomingPacket']([19, false]);
    expect(room.state.teamsLocked).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('quem entra DEPOIS do lock recebe tl:true no INFORM_IN_LOBBY', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    transport.sendPacket.mockClear();
    // PLAYER_JOIN: id, peerID, userName, guest, level, team, avatar
    room['handleIncomingPacket']([4, 1, 'peer1v00000', 'novato', false, 1, 1, { layers: [], bc: 0 }]);
    const call = transport.sendPacket.mock.calls.find((c) => c[0] === 11);
    expect(call).toBeDefined();
    expect(call![1].gs.tl).toBe(true);
  });

  it('o lock sobrevive à reconstrução da sala (reaplicado no ROOM_CREATED)', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    transport.sendPacket.mockClear();
    room['handleIncomingPacket']([2, 'sock2', 0]); // sala recriada (novo ROOM_CREATED)
    expect(transport.sendPacket).toHaveBeenCalledWith(7, { teamLock: true });
    expect(room.state.teamsLocked).toBe(true);
  });

  it('chamadas repetidas não reenviam o packet (evita rate_limit_tl)', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams(); room.lockTeams(); room.lockTeams();
    expect(transport.sendPacket.mock.calls.filter((c) => c[0] === 7)).toHaveLength(1);
  });

  it('rate_limit_tl do servidor: desfaz o estado local e tenta de novo depois de 1,5 s', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room['handleIncomingPacket']([16, 'rate_limit_tl']);
    expect(room.state.teamsLocked).toBe(false); // não mente sobre o que o servidor aceitou
    transport.sendPacket.mockClear();
    vi.advanceTimersByTime(1500);
    expect(transport.sendPacket).toHaveBeenCalledWith(7, { teamLock: true });
    expect(room.state.teamsLocked).toBe(true);
  });

  it('se o host destravou antes do retry, o retry não trava de novo', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room['handleIncomingPacket']([16, 'rate_limit_tl']);
    room.unlockTeams();
    transport.sendPacket.mockClear();
    vi.advanceTimersByTime(3000);
    expect(transport.sendPacket).not.toHaveBeenCalledWith(7, { teamLock: true });
  });

  it('ROOM_CREATED reaplica o lock mesmo se o estado local estava velho (true)', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    transport.sendPacket.mockClear();
    room['handleIncomingPacket']([2, 'sock3', 0]);
    expect(transport.sendPacket).toHaveBeenCalledWith(7, { teamLock: true });
  });

  // Regressão: com a sala travada e gs.tl=false no TRIGGER_START, os clients congelavam
  // (ninguém se movia). O gs.tl precisa refletir o lock real.
  it('TRIGGER_START leva gs.tl = estado real do lock', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.startGame({ is: 'blob' });
    expect(transport.sendPacket.mock.calls.find((c) => c[0] === 5)![1].gs.tl).toBe(false);
    room.lockTeams();
    room.startGame({ is: 'blob' });
    expect(transport.sendPacket.mock.calls.filter((c) => c[0] === 5).at(-1)![1].gs.tl).toBe(true);
  });

  it('INFORM_IN_GAME também leva gs.tl = estado real do lock', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room.informInGame(1, 10, { is: 'blob' });
    expect(transport.sendPacket.mock.calls.find((c) => c[0] === 40)![1].allData.gs.tl).toBe(true);
  });

  it('opts.gs.tl explícito continua tendo prioridade', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room.startGame({ is: 'blob', gs: { tl: false } });
    expect(transport.sendPacket.mock.calls.filter((c) => c[0] === 5).at(-1)![1].gs.tl).toBe(false);
  });

  it('depois de unlockTeams() a reconstrução NÃO trava de novo', () => {
    const { room, transport } = makeRoom();
    asHost(room);
    room.lockTeams();
    room.unlockTeams();
    transport.sendPacket.mockClear();
    room['handleIncomingPacket']([2, 'sock2', 0]);
    expect(transport.sendPacket).not.toHaveBeenCalledWith(7, expect.anything());
  });
});
