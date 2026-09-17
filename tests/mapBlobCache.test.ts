// mapBlobCache.test.ts — cache local de IS blobs por (mapa, jogadores ativos).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MapBlobCache, hashMap, DEFAULT_MAP_ID } from '../src/cache/mapBlobCache.js';

let dir: string;
let filePath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'map-blob-cache-test-'));
  filePath = join(dir, 'cache.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('hashMap', () => {
  it('mapeia null/undefined/vazio para DEFAULT_MAP_ID', () => {
    expect(hashMap(null)).toBe(DEFAULT_MAP_ID);
    expect(hashMap(undefined)).toBe(DEFAULT_MAP_ID);
    expect(hashMap('')).toBe(DEFAULT_MAP_ID);
  });

  it('é determinístico para o mesmo blob', () => {
    expect(hashMap('abc123')).toBe(hashMap('abc123'));
  });

  it('produz chaves diferentes para blobs diferentes', () => {
    expect(hashMap('mapaA')).not.toBe(hashMap('mapaB'));
  });
});

describe('MapBlobCache', () => {
  it('get retorna undefined quando não há arquivo nem entrada', () => {
    const cache = new MapBlobCache(filePath);
    expect(cache.get('algummapa', 1)).toBeUndefined();
  });

  it('set + get round-trip pela mesma instância', () => {
    const cache = new MapBlobCache(filePath);
    cache.set('mapaX', 2, 'blob-2-jogadores');
    expect(cache.get('mapaX', 2)).toBe('blob-2-jogadores');
    expect(cache.get('mapaX', 4)).toBeUndefined();
  });

  it('getForMap/setForMap usam hashMap internamente', () => {
    const cache = new MapBlobCache(filePath);
    cache.setForMap('lz-string-do-mapa', 1, 'blob-solo');
    expect(cache.getForMap('lz-string-do-mapa', 1)).toBe('blob-solo');
    expect(cache.get(hashMap('lz-string-do-mapa'), 1)).toBe('blob-solo');
  });

  it('mapa padrão (null) usa a chave DEFAULT_MAP_ID', () => {
    const cache = new MapBlobCache(filePath);
    cache.setForMap(null, 1, 'blob-mapa-padrao');
    expect(cache.get(DEFAULT_MAP_ID, 1)).toBe('blob-mapa-padrao');
  });

  it('persiste em disco e uma nova instância lê o que foi salvo', () => {
    const cache1 = new MapBlobCache(filePath);
    cache1.set('mapaY', 4, 'blob-4-jogadores');

    expect(existsSync(filePath)).toBe(true);
    const cache2 = new MapBlobCache(filePath);
    expect(cache2.get('mapaY', 4)).toBe('blob-4-jogadores');
  });

  it('cria diretórios intermediários que ainda não existem', () => {
    const nestedPath = join(dir, 'nested', 'deep', 'cache.json');
    const cache = new MapBlobCache(nestedPath);
    cache.set('m', 1, 'b');
    expect(existsSync(nestedPath)).toBe(true);
  });

  it('mapCount reflete o número de mapas distintos cacheados', () => {
    const cache = new MapBlobCache(filePath);
    expect(cache.mapCount).toBe(0);
    cache.set('mapaA', 1, 'b1');
    cache.set('mapaA', 2, 'b2');
    cache.set('mapaB', 1, 'b3');
    expect(cache.mapCount).toBe(2);
  });

  it('arquivo persistido tem o formato { [mapId]: { [count]: blob } }', () => {
    const cache = new MapBlobCache(filePath);
    cache.set('mapaZ', 1, 'blob-1');
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    expect(raw).toEqual({ mapaZ: { '1': 'blob-1' } });
  });
});
