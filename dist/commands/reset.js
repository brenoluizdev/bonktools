"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
const types_1 = require("../state/types");
const messages_1 = require("../messages");
exports.default = {
    name: "reset",
    description: "Vota para reiniciar a partida com o mesmo placar",
    execute(bot, name, args, message) {
        const state = roomState_1.roomState.getState();
        // Significa que só funciona em jogo
        if (state !== types_1.RoomState.IN_GAME && state !== types_1.RoomState.GAME_STARTING) {
            return;
        }
        const playerId = message.player.id;
        const currentMatch = roomState_1.roomState.getCurrentMatch();
        // Faz a verificacao se ta na partida
        const isInMatch = (currentMatch.picker && currentMatch.picker.id === playerId) ||
            (currentMatch.picked && currentMatch.picked.id === playerId);
        if (!isInMatch) {
            bot.chat(messages_1.MESSAGES.NOT_IN_GAME);
            return;
        }
        const { current, total } = roomState_1.roomState.addResetVote(playerId);
        bot.chat(messages_1.MESSAGES.VOTE_RESET(current, total));
        if (roomState_1.roomState.hasAllResetVotes()) {
            bot.chat(messages_1.MESSAGES.RESETTING_MATCH);
            // Reset sem alterar ratings
            roomState_1.roomState.setState(types_1.RoomState.READY);
            const queue = roomState_1.roomState.getQueue();
            queue.forEach(p => p.ready = false);
            setTimeout(() => {
                bot.chat(messages_1.MESSAGES.USE_READY_COMMAND);
            }, 1000);
        }
    },
};
