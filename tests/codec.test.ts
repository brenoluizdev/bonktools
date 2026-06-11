import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — estes imports FALHAM até o plano 02 criar os módulos codec.
// Isso é esperado e correto (princípio Nyquist: testes red antes da implementação).
import { decode } from '../src/codec/decode.js';
import { encodeTimesync } from '../src/codec/encode.js';

// As fixtures abaixo são literais de DemystifyBonk/Packets.md.
// O socket.io-client@2 já faz parse de "42[...]" para [N, ...args];
// nós testamos apenas a camada decode([N, ...args]).

describe('decode — packet 23 (timesync)', () => {
  it('decodifica resposta de timesync', () => {
    const raw: [number, ...unknown[]] = [23, { result: 1718000000000, id: 5 }];
    const packet = decode(raw);
    expect(packet).toEqual({
      type: 'TIMESYNC',
      time: 1718000000000,
      id: 5,
    });
  });
});

describe('decode — packet 16 (status)', () => {
  it('decodifica rate_limit_ready', () => {
    const raw: [number, ...unknown[]] = [16, 'rate_limit_ready'];
    const packet = decode(raw);
    expect(packet).toEqual({ type: 'STATUS_MESSAGE', status: 'rate_limit_ready' });
  });
});

describe('decode — packet 49 (share link)', () => {
  it('decodifica share link', () => {
    const raw: [number, ...unknown[]] = [49, 261254, 'agsey'];
    const packet = decode(raw);
    expect(packet).toEqual({ type: 'SHARE_LINK', roomId: 261254, bypass: 'agsey' });
    // Share link URL = 'https://bonk.io/' + roomId + bypass = 'https://bonk.io/261254agsey'
  });
});

describe('encode — timesync (packet 18)', () => {
  it('codifica request de timesync', () => {
    const result = encodeTimesync(5);
    expect(result).toEqual([18, { jsonrpc: '2.0', id: 5, method: 'timesync' }]);
  });
});

describe('decode — unknown packet', () => {
  it('retorna type UNKNOWN para packet não mapeado', () => {
    const raw: [number, ...unknown[]] = [99, 'data'];
    const packet = decode(raw);
    expect(packet.type).toBe('UNKNOWN');
  });
});
