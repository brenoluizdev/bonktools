"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rating_1 = require("../rating");
const messages_1 = require("../messages");
exports.default = {
    name: "rating",
    description: "Mostra o rating de um jogador",
    execute(bot, name, args, message) {
        const targetUsername = args.length > 0 ? args.join(" ") : message.player.username;
        const stats = rating_1.ratingSystem.getPlayerStats(targetUsername);
        if (!stats) {
            bot.chat(messages_1.MESSAGES.RATING_NOT_FOUND(targetUsername));
            return;
        }
        bot.chat(messages_1.MESSAGES.PLAYER_RATING(stats.username, stats.rating, stats.wins, stats.losses, stats.ties));
    },
};
