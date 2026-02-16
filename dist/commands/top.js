"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rating_1 = require("../rating");
const messages_1 = require("../messages");
exports.default = {
    name: "top",
    description: "Mostra o ranking dos melhores jogadores",
    execute(bot, name, args) {
        const count = args.length > 0 ? parseInt(args[0]) : 10;
        const limit = Math.min(Math.max(count, 1), 20); // Entre 1 e 20
        const topPlayers = rating_1.ratingSystem.getTopPlayers(limit);
        if (topPlayers.length === 0) {
            bot.chat(messages_1.MESSAGES.NO_PLAYERS_YET);
            return;
        }
        bot.chat(messages_1.MESSAGES.TOP_PLAYERS(topPlayers.length));
        topPlayers.forEach((player, index) => {
            const position = index + 1;
            bot.chat(`${position}. ${player.username}: ${Math.round(player.rating)} pts ` +
                `(V:${player.wins} D:${player.losses} E:${player.ties})`);
        });
    },
};
