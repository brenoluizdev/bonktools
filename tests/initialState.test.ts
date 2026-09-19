import { describe, expect, it } from 'vitest';
import LZString from 'lz-string';
import { decodeInitialState, encodeInitialState, remapInitialStatePlayers } from '../src/codec/initialState.js';

// Blob solo real (jogador id 1, azul), capturado de uma sala de football.
const SOLO =
  'jWcWiGhaqGDGCGkWeygybsaBaXGEIWuqefJIafaDWgKaTajLcxXaWemb1aeWhSoOaNcgfPOaBLGc2ajwWzjxDNd5jXanqbEwCGibIbUROlZZ8touXqsARhBplAVmwIAMhF36pMuQqWqNljLbiDlhcagDUUCBIEIS01AAM1ACKABIxcfEcAGYI5IRZ5PhIKYhYAOZphEEADhAF+ACa4toAzkikDfg4hNoALGEAHhzDcNraGPFQhN3admEA7Hxcyy0ArqsI1NOEaL0cZZCEMBi0hBQpWADiAyAApmwqAJ64WADCEB2v3WjVWy5QKWkDTY8Uu3UkamoDwA1mFSEk4N0VNCWAANUp4d4dME9fphcQASwJjwAbGTXpJtrMFksVutNttdvtDsdThR8BxLiookloq82AAXaoNWgCgDKUO00NuWUqKDg8VwABUYjA0AhiABeTVAA';

describe('IS blob', () => {
  it('re-codifica sem alterar o blob (round-trip)', () => {
    const s = decodeInitialState(SOLO);
    expect(encodeInitialState(s).length).toBeGreaterThan(0);
    expect(decodeInitialState(encodeInitialState(s))).toEqual(s);
  });

  it('move o jogador do slot 1 para o id real', () => {
    const s = decodeInitialState(SOLO);
    const out = decodeInitialState(remapInitialStatePlayers(SOLO, { 0: 0, 4: 1 }));
    expect(out.players[4]).toMatchObject({ id: 4, team: s.players[1]!.team });
    expect(out.discs[4]).toMatchObject({ x: s.discs[1]!.x, y: s.discs[1]!.y });
    expect(out.players[1]).toBeNull();
    expect(out.discs[1]).toBeNull();
  });

  it('não gera base64 com preenchimento "=" (o client rejeita)', () => {
    const s = decodeInitialState(SOLO);
    for (let extra = 0; extra < 4; extra++) {
      const players = Array.from({ length: 3 + extra }, (_, i) => (i === 0 ? null : { id: i, team: 2 }));
      const blob = encodeInitialState({ ...s, players, discs: players.map((p) => (p ? { x: 1, y: 2, xv: 0, yv: 0, team: 2, kickReady: true } : null)) } as never);
      const b64 = LZString.decompressFromEncodedURIComponent([...blob].map((c, i) => (i <= 100 ? (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) : c)).join(''));
      expect(b64).not.toContain('=');
      expect((b64 as string).length % 4).toBe(0); // grupos completos: nada é descartado pelo decoder do client
      expect(decodeInitialState(blob).players.length).toBe(players.length);
    }
  });

  it('o blob só usa o alfabeto URI-safe (o client decodifica com decompressFromEncodedURIComponent)', () => {
    const s = decodeInitialState(SOLO);
    for (let seed = 0; seed < 300; seed++) {
      const blob = encodeInitialState({ ...s, seed, players: [null, null, { id: 2, team: 3 }], discs: [null, null, { x: 10 + seed / 7, y: 22.7, xv: 0, yv: 0, team: 3, kickReady: true }] } as never);
      expect(blob).toMatch(/^[A-Za-z0-9+$-]+$/);
    }
  });

  it('devolve o original se o blob não tem o corpo pedido', () => {
    expect(remapInitialStatePlayers(SOLO, { 0: 0, 5: 1, 6: 2 })).toBe(SOLO);
  });
});
