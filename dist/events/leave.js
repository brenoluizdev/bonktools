"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = leaveEvent;
const messages_1 = require("../messages");
const transitions_1 = require("../state/transitions");
function leaveEvent(botInstance) {
    botInstance.events.on("PLAYER_LEAVE", (playerData) => {
        const player = playerData.player;
        botInstance.chat(messages_1.MESSAGES.PLAYER_LEFT(player.username));
        // Processar saída do jogador
        if (player.id !== 0) {
            (0, transitions_1.handlePlayerLeave)(botInstance, player.id);
        }
    });
}
