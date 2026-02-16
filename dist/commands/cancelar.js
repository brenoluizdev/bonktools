"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
const types_1 = require("../state/types");
const messages_1 = require("../messages");
exports.default = {
    name: "cancelar",
    description: "Vota para cancelar a partida",
    execute(bot, name, args, message) {
        const state = roomState_1.roomState.getState();
        // Só funciona em jogo
        if (state !== types_1.RoomState.IN_GAME && state !== types_1.RoomState.GAME_STARTING) {
            return;
        }
        const playerId = message.player.id;
        const currentMatch = roomState_1.roomState.getCurrentMatch();
        // Verifica se está na partida
        const isInMatch = (currentMatch.picker && currentMatch.picker.id === playerId) ||
            (currentMatch.picked && currentMatch.picked.id === playerId);
        if (!isInMatch) {
            bot.chat(messages_1.MESSAGES.NOT_IN_GAME);
            return;
        }
        const { current, total } = roomState_1.roomState.addCancelVote(playerId);
        bot.chat(messages_1.MESSAGES.VOTE_CANCEL(current, total));
        if (roomState_1.roomState.hasAllCancelVotes()) {
            bot.chat(messages_1.MESSAGES.CANCELLING_MATCH);
            // Resetar sala
            roomState_1.roomState.reset();
            // Tentar iniciar próxima partida
            const { tryStartNextMatch } = require("../state/transitions");
            setTimeout(() => {
                tryStartNextMatch(bot);
            }, 2000);
        }
    },
};
