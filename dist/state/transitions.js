"use strict";
/**
 * Lógica de transições entre estados da sala
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryStartNextMatch = tryStartNextMatch;
exports.handleMatchEnd = handleMatchEnd;
exports.handlePlayerLeave = handlePlayerLeave;
const roomState_1 = require("./roomState");
const types_1 = require("./types");
const messages_1 = require("../messages");
const room_1 = require("../config/room");
/**
 * Tenta iniciar a próxima partida se houver jogadores suficientes
 */
function tryStartNextMatch(bot) {
    const state = roomState_1.roomState.getState();
    // Só iniciar se estiver em IDLE
    if (state !== types_1.RoomState.IDLE) {
        return false;
    }
    // Precisa de pelo menos 2 jogadores
    if (!roomState_1.roomState.canStartMatch()) {
        console.log("[Transitions] Aguardando mais jogadores...");
        return false;
    }
    const queue = roomState_1.roomState.getQueue();
    const picker = queue[0];
    if (!picker)
        return false;
    // Se só tem 2 jogadores, iniciar direto
    if (queue.length === 2) {
        const picked = queue[1];
        roomState_1.roomState.setPicker(picker);
        roomState_1.roomState.setPicked(picked);
        bot.chat(messages_1.MESSAGES.MATCH_STARTING(picker.username, picked.username));
        bot.chat(`${picker.username}, entre no time vermelho.`);
        bot.chat(`${picked.username}, entre no time azul.`);
        roomState_1.roomState.setState(types_1.RoomState.READY);
        bot.chat(messages_1.MESSAGES.USE_READY_COMMAND);
        // Timer para ready
        roomState_1.roomState.startTimer("ready", () => {
            bot.chat(messages_1.MESSAGES.READY_TIMEOUT);
            roomState_1.roomState.reset();
            tryStartNextMatch(bot);
        }, room_1.TIMEOUTS.READY_TIME);
        return true;
    }
    // Mais de 2 jogadores: fase de pick
    roomState_1.roomState.setPicker(picker);
    roomState_1.roomState.setState(types_1.RoomState.PICK);
    bot.chat(messages_1.MESSAGES.YOUR_TURN_TO_PICK(picker.username));
    bot.chat(messages_1.MESSAGES.USE_PICK_COMMAND);
    // Timer para pick
    roomState_1.roomState.startTimer("pick", () => {
        bot.chat(messages_1.MESSAGES.PICK_TIMEOUT(picker.username));
        roomState_1.roomState.removeFromQueue(picker.id);
        roomState_1.roomState.reset();
        tryStartNextMatch(bot);
    }, room_1.TIMEOUTS.PICK_TIME);
    return true;
}
/**
 * Processa o fim de uma partida
 */
function handleMatchEnd(bot, winner) {
    const currentMatch = roomState_1.roomState.getCurrentMatch();
    if (!currentMatch.picker || !currentMatch.picked) {
        console.error("[Transitions] Match end sem jogadores definidos");
        return;
    }
    // Processar rating
    const { ratingSystem } = require("../rating");
    const winnerType = winner === "picker" ? "player1" : winner === "picked" ? "player2" : "tie";
    try {
        const result = ratingSystem.processMatch(currentMatch.picker.username, currentMatch.picked.username, winnerType);
        // Enviar mensagem com resultado
        if (winner === "tie") {
            bot.chat(messages_1.MESSAGES.MATCH_TIE(result.player1.username, result.player1.newRating, result.player1.change, result.player2.username, result.player2.newRating, result.player2.change));
        }
        else {
            const winnerResult = winner === "picker" ? result.player1 : result.player2;
            const loserResult = winner === "picker" ? result.player2 : result.player1;
            bot.chat(messages_1.MESSAGES.MATCH_RESULT(winnerResult.username, winnerResult.newRating, winnerResult.change, loserResult.username, loserResult.newRating, loserResult.change));
        }
    }
    catch (error) {
        console.error("[Transitions] Erro ao processar rating:", error);
    }
    // Rotacionar fila
    roomState_1.roomState.rotateQueue();
    // Resetar estado
    roomState_1.roomState.reset();
    // Tentar próxima partida
    setTimeout(() => {
        tryStartNextMatch(bot);
    }, 5000); // 5 segundos de delay
}
/**
 * Limpa o estado quando um jogador sai
 */
function handlePlayerLeave(bot, playerId) {
    const state = roomState_1.roomState.getState();
    const currentMatch = roomState_1.roomState.getCurrentMatch();
    // Se o jogador que saiu está na partida atual
    const wasInMatch = (currentMatch.picker && currentMatch.picker.id === playerId) ||
        (currentMatch.picked && currentMatch.picked.id === playerId);
    if (wasInMatch && state !== types_1.RoomState.IDLE) {
        // Cancelar partida se jogador importante sair
        bot.chat(messages_1.MESSAGES.CANCELLING_MATCH);
        roomState_1.roomState.reset();
        setTimeout(() => {
            tryStartNextMatch(bot);
        }, 2000);
    }
    // Remover da fila de qualquer forma
    roomState_1.roomState.removeFromQueue(playerId);
}
