/**
 * Extensões do bot para funcionalidades não expostas pelo bonktools
 */

import { CLIENT_MESSAGE_TYPES_NUM } from "../types/constants.types";

/**
 * Muda o time de outro jogador (requer host)
 * @param bot - Instância do bot
 * @param playerId - ID do jogador
 * @param team - Time de destino (0=spec, 1=FFA, 2=red, 3=blue)
 */
export async function changeOtherTeam(
  bot: any,
  playerId: number,
  team: number
): Promise<boolean> {
  try {
    if (typeof bot.sendMessage !== "function") {
      console.error("[BotExt] sendMessage não disponível");
      return false;
    }

    await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.CHANGE_OTHER_TEAM, {
      id: playerId,
      targetTeam: team,
    });

    console.log(`[BotExt] Time de player ${playerId} alterado para ${team}`);
    return true;
  } catch (error) {
    console.error(`[BotExt] Erro ao mudar time:`, error);
    return false;
  }
}

/**
 * Inicia o jogo como host (envia ready + countdown)
 * @param bot - Instância do bot
 */
export async function startGameAsHost(bot: any): Promise<boolean> {
  try {
    // 1. Host marca-se como pronto
    if (typeof bot.ready === "function") {
      await bot.ready(true);
      await new Promise((r) => setTimeout(r, 150));
    }

    // 2. Enviar countdown de 1 segundo
    if (typeof bot.sendMessage === "function") {
      await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.SEND_START_COUNTDOWN, 1);
      console.log("[BotExt] startGame: ready + countdown(1) enviados");
      return true;
    }

    return false;
  } catch (e) {
    console.error("[BotExt] startGameAsHost error:", e);
    throw e;
  }
}

/**
 * Reseta o ready de todos os jogadores
 * @param bot - Instância do bot
 */
export async function allReadyReset(bot: any): Promise<boolean> {
  try {
    if (typeof bot.sendMessage !== "function") {
      return false;
    }

    await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.ALL_READY_RESET, {});
    console.log("[BotExt] allReadyReset enviado");
    return true;
  } catch (error) {
    console.error("[BotExt] Erro ao resetar ready:", error);
    return false;
  }
}
