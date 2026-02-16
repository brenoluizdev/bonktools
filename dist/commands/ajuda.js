"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messages_1 = require("../messages");
exports.default = {
    name: "ajuda",
    description: "Mostra os comandos disponíveis",
    execute(bot) {
        bot.chat(messages_1.HELP_TEXT);
    },
};
