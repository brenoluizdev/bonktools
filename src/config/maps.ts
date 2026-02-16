import path from 'path';
import fs from 'fs';
import { getModeConfig } from './modeConfig';

export interface MapEntry {
  id: number;
  name: string;
  authorname?: string;
  leveldata: string;
  publisheddate?: string;
  vu?: number;
  vd?: number;
  remixname?: string;
  remixauthor?: string;
  remixdb?: number;
  remixid?: number;
}

let mapsCache: MapEntry[] | null = null;

function loadMapsJson(): MapEntry[] {
  if (mapsCache) return mapsCache;
  const p = path.join(process.cwd(), 'config', 'maps.json');
  if (!fs.existsSync(p)) {
    console.warn('[Maps] config/maps.json não encontrado');
    mapsCache = [];
    return mapsCache;
  }
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const arr = JSON.parse(raw) as MapEntry[];
    mapsCache = Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('[Maps] Erro ao carregar config/maps.json:', (e as Error).message);
    mapsCache = [];
  }
  return mapsCache;
}

export function getMapById(mapId: number): MapEntry | undefined {
  return loadMapsJson().find(m => m.id === mapId);
}

/** Retorna o mapa configurado para o modo. Usado para passar em RoomParameters.maps como [JSON.stringify(map)]. */
export function getMapForMode(modeId: string): MapEntry | undefined {
  const config = getModeConfig(modeId);
  if (!config) return undefined;
  return getMapById(config.mapId);
}

/** Retorna array de strings (JSON do mapa) para RoomParameters.maps. Vazio se mapa não existir. */
export function getMapJsonStringsForMode(modeId: string): string[] {
  const map = getMapForMode(modeId);
  if (!map || !map.leveldata) return [];
  return [JSON.stringify(map)];
}
