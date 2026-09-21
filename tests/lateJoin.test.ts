import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { BonkRoom } from '../src/room/BonkRoom.js';
import { OUTGOING_PACKET_IDS } from '../src/codec/packets.js';
import { encodeInformInGame } from '../src/codec/encode.js';

/**
 * Espectador que entra com a partida em andamento: o host manda INFORM_IN_GAME. O client só troca MUDANÇAS de teclas
 * (não posições), então esse pacote precisa carregar TODO o histórico de teclas da partida (`inputs`), senão quem
 * entra simula com todo mundo parado e os discos "voam" (medido com navegadores reais: 0% dos estados batiam;
 * com o histórico, ~99%).
 */
const transport = () => ({
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  sendPacket: vi.fn(),
  getState: vi.fn().mockReturnValue('connected'),
});

const makeHost = () => {
  const t = transport();
  const room = new BonkRoom({ desiredState: { roomName: 'T', password: '', mode: 'f', rounds: 3 }, logger: pino({ level: 'silent' }), transport: t as never });
  // o bot é o host
  room['_state'] = { ...room['_state'], myId: 0, hostId: 0 };
  return { room, t };
};

const join = (room: BonkRoom, id: number) =>
  room['handleIncomingPacket']([4, id, `peer${id}`, `Player${id}`, true, 0, 5, false, false, { layers: [], bc: 0 }]);
const input = (room: BonkRoom, p: number, f: number, i: number, c = 0) => room['handleIncomingPacket']([7, p, { i, f, c }]);
const startGame = (room: BonkRoom) => {
  room['pendingGameOpts'] = { is: 'IS-BLOB' };
  room['handleIncomingPacket']([15, Date.now(), 'IS-BLOB', { map: '', gt: 2, wl: 3, q: false, tl: false, tea: false, ga: 'f', mo: 'f', bal: [] }]);
};
const informPackets = (t: ReturnType<typeof transport>) => t.sendPacket.mock.calls.filter((c) => c[0] === OUTGOING_PACKET_IDS.INFORM_IN_GAME).map((c) => c[1] as { sid: number; allData: { state: string; stateID: number; fc: number; inputs: { p: number; f: number; i: number }[] } });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('INFORM_IN_GAME (entrada tardia)', () => {
  it('manda o histórico de teclas da partida, em ordem de quadro, com o estado inicial (stateID 0)', () => {
    const { room, t } = makeHost();
    join(room, 1);
    join(room, 2);
    startGame(room);
    vi.advanceTimersByTime(3000); // ~90 quadros
    // chegam fora de ordem (o servidor não garante a ordem entre jogadores)
    input(room, 2, 40, 2);
    input(room, 1, 10, 1);
    input(room, 1, 55, 0);
    input(room, 2, 20, 8);
    t.sendPacket.mockClear();

    join(room, 3); // o terceiro entra com a partida rolando

    const sent = informPackets(t);
    expect(sent).toHaveLength(1);
    const { sid, allData } = sent[0]!;
    expect(sid).toBe(3);
    expect(allData.state).toBe('IS-BLOB'); // estado inicial (quadro 0)
    expect(allData.stateID).toBe(0);
    expect(allData.inputs).toEqual([
      { p: 1, f: 10, i: 1 },
      { p: 2, f: 20, i: 8 },
      { p: 2, f: 40, i: 2 },
      { p: 1, f: 55, i: 0 },
    ]);
    expect(allData.fc).toBeGreaterThanOrEqual(55); // nunca antes do último quadro que os jogadores já enviaram
  });

  it('fc não fica atrás do último quadro visto, mesmo com o relógio do host adiantado/atrasado', () => {
    const { room, t } = makeHost();
    join(room, 1);
    startGame(room);
    input(room, 1, 500, 4); // os clients já estão no quadro 500, o relógio do host ainda no 0
    t.sendPacket.mockClear();
    join(room, 2);
    expect(informPackets(t)[0]!.allData.fc).toBe(500);
  });

  it('o histórico é da partida atual: zera ao acabar e ao começar outra', () => {
    const { room, t } = makeHost();
    join(room, 1);
    startGame(room);
    input(room, 1, 10, 4);
    room['handleIncomingPacket']([13]); // fim da partida (GAME_END)
    startGame(room);
    input(room, 1, 3, 2);
    t.sendPacket.mockClear();
    join(room, 2);
    expect(informPackets(t)[0]!.allData.inputs).toEqual([{ p: 1, f: 3, i: 2 }]);
  });

  it('não grava teclas fora de partida, nem pacotes 7 malformados; e não manda INFORM_IN_GAME no lobby', () => {
    const { room, t } = makeHost();
    join(room, 1);
    input(room, 1, 10, 4); // sem partida ativa
    room['handleIncomingPacket']([7, 1, { f: 3 }]); // sem `i`
    room['handleIncomingPacket']([7, 'x', { i: 1, f: 3 }]); // id inválido
    startGame(room);
    room['handleIncomingPacket']([7, 1, { i: 'a', f: 3 }]);
    room['handleIncomingPacket']([7]);
    t.sendPacket.mockClear();
    join(room, 2);
    expect(informPackets(t)[0]!.allData.inputs).toEqual([]);

    const lobby = makeHost();
    join(lobby.room, 1);
    lobby.t.sendPacket.mockClear();
    join(lobby.room, 2);
    expect(informPackets(lobby.t)).toHaveLength(0); // sem partida: caminho INFORM_IN_LOBBY
  });

  it('o histórico tem teto: passando dele para de gravar (não cresce sem limite)', () => {
    const { room, t } = makeHost();
    join(room, 1);
    startGame(room);
    const max = (BonkRoom as unknown as { MAX_GAME_INPUTS: number }).MAX_GAME_INPUTS;
    for (let n = 0; n < max + 50; n++) input(room, 1, n, n % 64);
    t.sendPacket.mockClear();
    join(room, 2);
    expect(informPackets(t)[0]!.allData.inputs).toHaveLength(max);
  });

  it('encodeInformInGame: inputs vazios por padrão e stateID 0', () => {
    const p = encodeInformInGame(4, { roomName: 'T', password: '', mode: 'f', rounds: 3 } as never, 100, { is: 'X' });
    expect(p.allData.inputs).toEqual([]);
    expect(p.allData.stateID).toBe(0);
    expect(p.allData.fc).toBe(100);
  });
});
