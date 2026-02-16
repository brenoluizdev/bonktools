/**
 * Utilitários para investigação de GAME_START / Trigger Start.
 * Usado quando INVESTIGATION=1 ou para debug.
 */

/** Ativo quando uma corrida de investigação está em andamento (pode ser setado por outros módulos). */
export let investigationRunActive = false;

export function setInvestigationRunActive(value: boolean): void {
  investigationRunActive = value;
}

/**
 * Registra payload de GAME_START recebido (para comparação host vs bot).
 * Chamado por packet.ts quando INVESTIGATION_TRIGGER_START ou investigationRunActive.
 */
export function logGameStartReceived(payload: unknown[]): void {
  console.log("[Investigation] GAME_START payload:", JSON.stringify(payload, null, 2));
}
