"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = gameEnd;
const messages_1 = require("../messages");
const transitions_1 = require("../state/transitions");
const roomState_1 = require("../state/roomState");
const types_1 = require("../state/types");
function gameEnd(botInstance) {
    botInstance.events.on("GAME_END", () => {
        botInstance.chat(messages_1.MESSAGES.GAME_ENDED);
        const state = roomState_1.roomState.getState();
        // Só processar se estiver em jogo
        if (state !== types_1.RoomState.IN_GAME && state !== types_1.RoomState.GAME_STARTING) {
            return;
        }
        // Tentar determinar vencedor
        // Nota: isso depende da API do bonktools expor o resultado
        // Por enquanto, considerar empate se não conseguir determinar
        try {
            // TODO: Adaptar para pegar placar real do bonktools
            // const players = botInstance.getAllPlayers(true);
            // const scores = botInstance.getScores(); // se existir
            // Por enquanto, processar como empate
            (0, transitions_1.handleMatchEnd)(botInstance, "tie");
        }
        catch (error) {
            console.error("[GameEnd] Erro ao processar fim de jogo:", error);
            // Em caso de erro, resetar e tentar próxima
            roomState_1.roomState.reset();
            const { tryStartNextMatch } = require("../state/transitions");
            setTimeout(() => {
                tryStartNextMatch(botInstance);
            }, 2000);
        }
    });
}
