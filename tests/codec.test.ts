import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — estes imports FALHAM até o plano 02 criar os módulos codec.
// Isso é esperado e correto (princípio Nyquist: testes red antes da implementação).
import { decode } from '../src/codec/decode.js';
import { encodeTimesync } from '../src/codec/encode.js';
// Wave 0 Fase 2 — imports adicionais; falham até os planos 02-02/02-03 criarem os módulos.
import { decodeWithZod } from '../src/codec/decode.js';
import { TERMINAL_STATUS_CODES, RATE_LIMIT_CODES } from '../src/codec/packets.js';
import pino from 'pino';

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

// ─── Fase 2: zod safeParse, StatusCode union, TERMINAL_STATUS_CODES, RATE_LIMIT_CODES ───

describe('TERMINAL_STATUS_CODES — classificação de status terminal (OBS-02)', () => {
  it('contém banned como código terminal', () => {
    expect(TERMINAL_STATUS_CODES.has('banned')).toBe(true);
  });

  it('contém room_full como código terminal', () => {
    expect(TERMINAL_STATUS_CODES.has('room_full')).toBe(true);
  });
});

describe('RATE_LIMIT_CODES — classificação de rate limit (OBS-04)', () => {
  it('contém rate_limit como código de rate limit', () => {
    expect(RATE_LIMIT_CODES.has('rate_limit')).toBe(true);
  });

  it('contém rate_limit_ready como código de rate limit', () => {
    expect(RATE_LIMIT_CODES.has('rate_limit_ready')).toBe(true);
  });
});

describe('decodeWithZod — packet 3 válido retorna ROOM_JOIN (D-10)', () => {
  it('valida e decodifica packet 3 com safeParse, retornando type ROOM_JOIN', () => {
    const logger = pino({ level: 'silent' });
    // Fixture de packet 3 (JOIN_ROOM): myId, hostId, players[], timestamp, teamsLocked, roomId, roomBypass
    const raw: [number, ...unknown[]] = [
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
    ];
    const packet = decodeWithZod(raw, logger);
    expect(packet.type).toBe('ROOM_JOIN');
  });
});

describe('decodeWithZod — packet malformado retorna UNKNOWN sem lançar (D-11)', () => {
  it('não lança exceção; retorna type UNKNOWN com raw preservado', () => {
    const logger = pino({ level: 'silent' });
    // Packet 3 com dados inválidos (string onde esperado objeto de player)
    const raw: [number, ...unknown[]] = [3, 'dados_invalidos'];
    const packet = decodeWithZod(raw, logger);
    expect(packet.type).toBe('UNKNOWN');
  });
});
