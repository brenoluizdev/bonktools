"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMapById = getMapById;
exports.getMapForMode = getMapForMode;
exports.getMapJsonStringsForMode = getMapJsonStringsForMode;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const modeConfig_1 = require("./modeConfig");
let mapsCache = null;
function loadMapsJson() {
    if (mapsCache)
        return mapsCache;
    const p = path_1.default.join(process.cwd(), 'config', 'maps.json');
    if (!fs_1.default.existsSync(p)) {
        console.warn('[Maps] config/maps.json não encontrado');
        mapsCache = [];
        return mapsCache;
    }
    try {
        const raw = fs_1.default.readFileSync(p, 'utf-8');
        const arr = JSON.parse(raw);
        mapsCache = Array.isArray(arr) ? arr : [];
    }
    catch (e) {
        console.warn('[Maps] Erro ao carregar config/maps.json:', e.message);
        mapsCache = [];
    }
    return mapsCache;
}
function getMapById(mapId) {
    return loadMapsJson().find(m => m.id === mapId);
}
/** Retorna o mapa configurado para o modo. Usado para passar em RoomParameters.maps como [JSON.stringify(map)]. */
function getMapForMode(modeId) {
    const config = (0, modeConfig_1.getModeConfig)(modeId);
    if (!config)
        return undefined;
    return getMapById(config.mapId);
}
/** Retorna array de strings (JSON do mapa) para RoomParameters.maps. Vazio se mapa não existir. */
function getMapJsonStringsForMode(modeId) {
    const map = getMapForMode(modeId);
    if (!map || !map.leveldata)
        return [];
    return [JSON.stringify(map)];
}
