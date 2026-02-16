"use strict";
/**
 * Configuração central de todos os modos.
 * Para adicionar um novo modo: inclua aqui e implemente em src/modes/<id>/.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODE_CONFIGS = void 0;
exports.getModeConfig = getModeConfig;
exports.getRoomNameEnvKey = getRoomNameEnvKey;
exports.MODE_CONFIGS = [
    { id: 'mbappa1x1', name: 'Mbappa 1x1', mapId: 1345744, gameMode: 'b', rounds: 5, teams: true, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_MBAPPA_1X1' },
    { id: 'mbappa2x2', name: 'Mbappa 2x2', mapId: 1345744, gameMode: 'b', rounds: 5, teams: true, flowType: '2v2-sub', roomNameEnvKey: 'ROOM_NAME_MBAPPA_2X2' },
    { id: 'classic1x1', name: 'Classic 1x1', mapId: 123, gameMode: 'b', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_CLASSIC_1X1' },
    { id: 'grapple1x1', name: 'Grapple 1v1', mapId: 225844, gameMode: 'sp', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_GRAPPLE_1X1' },
    { id: 'deatharrow1x1', name: 'Death Arrow 1v1', mapId: 1071270, gameMode: 'ard', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_DEATHARROW_1X1' },
    { id: 'blclassic', name: 'BL Classic', mapId: 594396, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_CLASSIC' },
    { id: 'volei1x1', name: 'Vôlei de rua 1x1', mapId: 848488, gameMode: 'b', rounds: 5, teams: true, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_VOLEI_1X1' },
    { id: 'barkball', name: 'Barkball', mapId: 1139002, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BARKBALL' },
    { id: 'blbasketball', name: 'BL Basketball', mapId: 863406, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_BASKETBALL' },
    { id: 'blvolleyball', name: 'BL Volleyball', mapId: 908951, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_VOLLEYBALL' },
    { id: 'corridacart', name: 'Corrida de Cart', mapId: 1176992, gameMode: 'f', rounds: 5, teams: false, flowType: 'ffa', roomNameEnvKey: 'ROOM_NAME_CORRIDA_CART' },
];
const byId = new Map();
for (const c of exports.MODE_CONFIGS)
    byId.set(c.id, c);
function getModeConfig(modeId) {
    return byId.get(modeId.toLowerCase());
}
function getRoomNameEnvKey(modeId) {
    return getModeConfig(modeId)?.roomNameEnvKey ?? 'ROOM_NAME';
}
