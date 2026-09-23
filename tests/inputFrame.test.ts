import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { parseInputFrame } from '../src/webrtc/inputFrame.js';
import { ScoreTracker } from '../src/score/ScoreTracker.js';

vi.mock('../src/codec/initialState.js', async (orig) => ({
  ...(await orig<typeof import('../src/codec/initialState.js')>()),
  decodeInitialState: () => ({}),
}));

// Mesmos bytes do buildInputFrame do PeerBrokerClient (i=6, f=0x045e, c=200).
const FRAME = Buffer.from([0x83, 0xa1, 0x69, 0xcc, 6, 0xa1, 0x66, 0xcd, 0x04, 0x5e, 0xa1, 0x63, 0xcc, 200]);

describe('parseInputFrame (input por WebRTC)', () => {
  it('lê o frame no formato que o host manda', () => {
    expect(parseInputFrame(FRAME)).toEqual({ i: 6, f: 1118, c: 200 });
  });

  it('aceita inteiros curtos (fixint), uint32 e outra ordem de chaves', () => {
    expect(parseInputFrame(Buffer.from([0x83, 0xa1, 0x63, 3, 0xa1, 0x69, 5, 0xa1, 0x66, 16]))).toEqual({ i: 5, f: 16, c: 3 });
    expect(parseInputFrame(Buffer.from([0x82, 0xa1, 0x69, 2, 0xa1, 0x66, 0xce, 0, 1, 0, 0]))).toEqual({ i: 2, f: 65536, c: 0 });
  });

  it('recusa o que não é frame de input', () => {
    expect(parseInputFrame(Buffer.from('hello world'))).toBeNull();
    expect(parseInputFrame(FRAME.subarray(0, 9))).toBeNull(); // truncado
    expect(parseInputFrame(Buffer.from([0x82, 0xa1, 0x69, 2, 0xa1, 0x63, 1]))).toBeNull(); // sem f
    expect(parseInputFrame(Buffer.concat([FRAME, Buffer.from([0])]))).toBeNull(); // lixo no fim
  });
});

describe('ScoreTracker: inputs que chegam por WebRTC', () => {
  function setup() {
    const room = new EventEmitter();
    const tracker = new ScoreTracker(room as never, { cacheDir: '.' });
    const posted: Array<{ type: string; id?: number; i?: number; f?: number; c?: number }> = [];
    const t = tracker as unknown as {
      _ready: boolean;
      worker: { postMessage: (m: never) => void };
      beginMatch: (is: string, gs: unknown) => void;
      handlePeerInput: (ev: { playerId: number; peerID: string; data: Buffer }) => void;
      handleRaw: (pkt: { type: string; raw?: unknown[] }) => void;
    };
    t._ready = true;
    t.worker = { postMessage: (m) => posted.push(m) };
    t.beginMatch('x', { ga: 'f', wl: 3 });
    const inputs = () => posted.filter((m) => m.type === 'input');
    return { t, inputs };
  }

  it('alimenta a simulação com o input do WebRTC (antes era ignorado: jogador "parado" pro bot)', () => {
    vi.useFakeTimers();
    try {
      const { t, inputs } = setup();
      vi.advanceTimersByTime(40_000); // ~1200 quadros de partida
      t.handlePeerInput({ playerId: 2, peerID: 'p', data: FRAME });
      expect(inputs()).toEqual([{ type: 'input', id: 2, i: 6, f: 1118, c: 200 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('o mesmo input pelos dois caminhos (WebRTC e servidor) entra uma vez só', () => {
    vi.useFakeTimers();
    try {
      const { t, inputs } = setup();
      vi.advanceTimersByTime(40_000);
      t.handlePeerInput({ playerId: 2, peerID: 'p', data: FRAME });
      t.handleRaw({ type: 'UNKNOWN', raw: [7, 2, { i: 6, f: 1118, c: 200 }] });
      t.handleRaw({ type: 'UNKNOWN', raw: [7, 2, { i: 0, f: 1130, c: 201 }] }); // input novo: entra
      expect(inputs().map((m) => m.f)).toEqual([1118, 1130]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('recupera o quadro completo quando a partida passa de 65536 quadros (o WebRTC leva 16 bits)', () => {
    vi.useFakeTimers();
    try {
      const { t, inputs } = setup();
      vi.advanceTimersByTime(((65536 + 1118) / 30) * 1000);
      t.handlePeerInput({ playerId: 2, peerID: 'p', data: FRAME });
      expect(inputs()[0]!.f).toBe(65536 + 1118);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fora de partida, nada entra', () => {
    const { t, inputs } = setup();
    (t as unknown as { endMatch: () => void }).endMatch();
    t.handlePeerInput({ playerId: 2, peerID: 'p', data: FRAME });
    expect(inputs()).toEqual([]);
  });
});
