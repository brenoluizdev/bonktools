"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
exports.default = {
    name: "players",
    description: "Mostra os jogadores online",
    execute(bot) {
        const players = bot.getAllPlayers(true);
        const names = players.map((p) => p.username);
        const count = players.length;
        bot.chat(`👥 Jogadores online (${count}): ${names.join(", ")}`);
        // Também mostrar fila
        const queue = roomState_1.roomState.getQueue();
        if (queue.length > 0) {
            bot.chat(`📋 Na fila (${queue.length}): ${queue.map(p => p.username).join(", ")}`);
        }
    },
};
