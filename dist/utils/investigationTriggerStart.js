"use strict";
/**
 * Utilitários para investigação de GAME_START / Trigger Start.
 * Usado quando INVESTIGATION=1 ou para debug.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.investigationRunActive = void 0;
exports.setInvestigationRunActive = setInvestigationRunActive;
exports.logGameStartReceived = logGameStartReceived;
/** Ativo quando uma corrida de investigação está em andamento (pode ser setado por outros módulos). */
exports.investigationRunActive = false;
function setInvestigationRunActive(value) {
    exports.investigationRunActive = value;
}
/**
 * Registra payload de GAME_START recebido (para comparação host vs bot).
 * Chamado por packet.ts quando INVESTIGATION_TRIGGER_START ou investigationRunActive.
 */
function logGameStartReceived(payload) {
    console.log("[Investigation] GAME_START payload:", JSON.stringify(payload, null, 2));
}
