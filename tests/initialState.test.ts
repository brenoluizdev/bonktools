import { describe, expect, it } from 'vitest';
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

  it('devolve o original se o blob não tem o corpo pedido', () => {
    expect(remapInitialStatePlayers(SOLO, { 0: 0, 5: 1, 6: 2 })).toBe(SOLO);
  });
});
