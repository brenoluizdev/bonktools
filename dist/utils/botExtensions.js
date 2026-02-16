"use strict";
/**
 * Extensões do bot para funcionalidades não expostas pelo bonktools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeOtherTeam = changeOtherTeam;
exports.startGameAsHost = startGameAsHost;
exports.allReadyReset = allReadyReset;
const constants_types_1 = require("../types/constants.types");
/**
 * Muda o time de outro jogador (requer ser host)
 * @param bot - Instância do bot
 * @param playerId - ID do jogador
 * @param team - Time de destino (0=spec, 1=FFA, 2=red, 3=blue)
 */
async function changeOtherTeam(bot, playerId, team) {
    try {
        if (typeof bot.sendMessage !== "function") {
            console.error("[BotExt] sendMessage não disponível");
            return false;
        }
        await bot.sendMessage(constants_types_1.CLIENT_MESSAGE_TYPES_NUM.CHANGE_OTHER_TEAM, {
            id: playerId,
            targetTeam: team,
        });
        console.log(`[BotExt] Time de player ${playerId} alterado para ${team}`);
        return true;
    }
    catch (error) {
        console.error(`[BotExt] Erro ao mudar time:`, error);
        return false;
    }
}
/**
 * Inicia o jogo como host (envia ready + countdown)
 * @param bot - Instância do bot
 */
async function startGameAsHost(bot) {
    try {
        // 1. Host marca-se como pronto
        if (typeof bot.ready === "function") {
            await bot.ready(true);
            await new Promise((r) => setTimeout(r, 150));
        }
        // 2. Enviar countdown de 1 segundo
        if (typeof bot.sendMessage === "function") {
            await bot.sendMessage(constants_types_1.CLIENT_MESSAGE_TYPES_NUM.SEND_START_COUNTDOWN, 1);
            console.log("[BotExt] startGame: ready + countdown(1) enviados");
            return true;
        }
        return false;
    }
    catch (e) {
        console.error("[BotExt] startGameAsHost error:", e);
        throw e;
    }
}
/**
 * Reseta o ready de todos os jogadores
 * @param bot - Instância do bot
 */
async function allReadyReset(bot) {
    try {
        if (typeof bot.sendMessage !== "function") {
            return false;
        }
        await bot.sendMessage(constants_types_1.CLIENT_MESSAGE_TYPES_NUM.ALL_READY_RESET, {});
        console.log("[BotExt] allReadyReset enviado");
        return true;
    }
    catch (error) {
        console.error("[BotExt] Erro ao resetar ready:", error);
        return false;
    }
}
