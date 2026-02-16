"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
const messages_1 = require("../messages");
exports.default = {
    name: "fila",
    description: "Mostra a fila de jogadores",
    execute(bot) {
        const queue = roomState_1.roomState.getQueue();
        if (queue.length === 0) {
            bot.chat(messages_1.MESSAGES.QUEUE_EMPTY);
            return;
        }
        const playerNames = queue.map(p => p.username);
        bot.chat(messages_1.MESSAGES.QUEUE_LIST(playerNames));
    },
};
