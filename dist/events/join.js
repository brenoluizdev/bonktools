"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = joinEvent;
const joinTeam_types_1 = require("../types/joinTeam.types");
const messages_1 = require("../messages");
const roomState_1 = require("../state/roomState");
const transitions_1 = require("../state/transitions");
function joinEvent(botInstance) {
    botInstance.events.on("PLAYER_JOIN", (playerData) => {
        const player = playerData.player;
        // Mensagens de boas-vindas
        botInstance.chat(messages_1.MESSAGES.WELCOME(player.username));
        botInstance.chat(messages_1.MESSAGES.DEV_WARNING);
        setTimeout(() => {
            botInstance.chat(messages_1.MESSAGES.DISCORD_LINK);
        }, 5000);
        // Bot sempre vai para spec se mais de 1 jogador
        const playersLength = botInstance.getAllPlayers(true);
        if (player.username === "FUTHERO BOT" || playersLength.length > 1) {
            botInstance.joinTeam(joinTeam_types_1.JoinTeam.SPEC);
        }
        // Adicionar à fila (exceto o bot)
        if (player.id !== 0 && player.username !== "FUTHERO BOT") {
            const newPlayer = {
                id: player.id,
                username: player.username,
                team: player.team || 0,
                ready: false,
                joinedAt: Date.now(),
            };
            const added = roomState_1.roomState.addToQueue(newPlayer);
            if (added) {
                botInstance.chat(messages_1.MESSAGES.ADDED_TO_QUEUE(player.username));
                // Tentar iniciar partida se houver jogadores suficientes
                setTimeout(() => {
                    (0, transitions_1.tryStartNextMatch)(botInstance);
                }, 2000);
            }
        }
    });
}
