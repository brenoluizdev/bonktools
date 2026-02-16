"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = chatMessageEvent;
const handler_1 = require("../commands/handler");
const node_fetch_1 = __importDefault(require("node-fetch"));
function chatMessageEvent(botInstance) {
    botInstance.events.on("CHAT_MESSAGE", async (message) => {
        console.log(`${message.player.username}: ${message.message}`);
        if (message.message.startsWith("!")) {
            const args = message.message.slice(1).split(" ");
            const commandName = args.shift()?.toLowerCase();
            if (commandName) {
                // Aliases de comandos
                const aliases = {
                    "queue": "fila",
                    "q": "fila",
                    "help": "ajuda",
                    "h": "ajuda",
                    "escolher": "p",
                    "pick": "p",
                    "pronto": "r",
                    "ready": "r",
                    "re": "reset",
                    "c": "cancelar",
                    "cancel": "cancelar",
                    "rank": "rating",
                };
                const finalCommand = aliases[commandName] || commandName;
                (0, handler_1.runCommand)(botInstance, finalCommand, args, message);
            }
        }
        // Webhook Discord (opcional)
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                await (0, node_fetch_1.default)(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: `${message.player.username || "FUTHERO BOT"}: ${message.message}`,
                    })
                });
            }
            catch (error) {
                console.error('Error sending message to webhook:', error);
            }
        }
    });
}
