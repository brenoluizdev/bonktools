"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    name: "teste3",
    description: "teste3",
    async execute(bot, name, args, message) {
        const player = message.player;
        bot.giveHost(player.id);
    },
};
