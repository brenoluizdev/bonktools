/**
 * mapBlobCache.ts — cache local de IS blobs indexado por mapa + contagem de jogadores.
 *
 * Contexto: o IS blob (estado inicial da física) codifica posições de spawn que
 * dependem do MAPA ativo na sala, não só do gamemode. Um blob capturado num mapa
 * não é seguro para reuso em outro mapa — o client bonk.io quebra ao decodificar
 * (RangeError na engine de física) e a partida trava visualmente no lobby.
 *
 * Como o protocolo do bonk.io não expõe um ID estável de mapa, a chave usada aqui
 * é o hash SHA-256 do próprio blob do mapa (BonkRoom.currentMap) — determinístico,
 * sem depender de nome/autor que podem repetir ou ser editados. Mapa padrão
 * (currentMap === null) usa a chave sentinela `DEFAULT_MAP_ID`.
 *
 * Formato de armazenamento: JSON local, { [mapId]: { [totalPlayers]: isBlob } }.
 * Adequado para o cache de UM bot/deployment (dezenas a poucas centenas de mapas
 * encontrados organicamente pelas salas que ele gerencia). Uma base compartilhada
 * entre múltiplos usuários da lib (potencialmente milhares de mapas) deve ficar
 * atrás de uma API própria — fora do escopo deste módulo, que é só o cache local.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Chave sentinela usada quando a sala está no mapa padrão do bonk.io (sem customização). */
export const DEFAULT_MAP_ID = 'default';

/**
 * Deriva a chave estável (mapId) a partir do blob LZ-String do mapa.
 * `mapBlob` é o valor de `BonkRoom.currentMap` — `null`/vazio mapeia para
 * `DEFAULT_MAP_ID` (mapa padrão do bonk.io, sem SEND_MAP_ADD customizado).
 */
export function hashMap(mapBlob: string | null | undefined): string {
  if (!mapBlob) return DEFAULT_MAP_ID;
  return createHash('sha256').update(mapBlob, 'utf8').digest('hex');
}

type CacheData = Record<string, Record<string, string>>;

/**
 * Cache local (arquivo JSON) de IS blobs por (mapId, totalPlayers).
 * Carrega o arquivo (se existir) na construção; cada `set()` persiste
 * imediatamente (escrita síncrona — volume baixo, não é hot path).
 */
export class MapBlobCache {
  private readonly filePath: string;
  private data: CacheData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = existsSync(filePath)
      ? (JSON.parse(readFileSync(filePath, 'utf8')) as CacheData)
      : {};
  }

  /** Retorna o IS blob cacheado para (mapId, totalPlayers), ou `undefined` se ainda não capturado. */
  get(mapId: string, totalPlayers: number): string | undefined {
    return this.data[mapId]?.[String(totalPlayers)];
  }

  /** Retorna o IS blob cacheado a partir do blob do mapa (atalho sobre hashMap + get). */
  getForMap(mapBlob: string | null | undefined, totalPlayers: number): string | undefined {
    return this.get(hashMap(mapBlob), totalPlayers);
  }

  /** Grava um IS blob no cache para (mapId, totalPlayers) e persiste em disco. */
  set(mapId: string, totalPlayers: number, isBlob: string): void {
    this.data[mapId] ??= {};
    this.data[mapId]![String(totalPlayers)] = isBlob;
    this.persist();
  }

  /** Grava um IS blob a partir do blob do mapa (atalho sobre hashMap + set). */
  setForMap(mapBlob: string | null | undefined, totalPlayers: number, isBlob: string): void {
    this.set(hashMap(mapBlob), totalPlayers, isBlob);
  }

  /** Quantos mapas distintos já têm ao menos um blob cacheado. */
  get mapCount(): number {
    return Object.keys(this.data).length;
  }

  private persist(): void {
    const dir = dirname(this.filePath);
    if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}
