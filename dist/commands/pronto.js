"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
const types_1 = require("../state/types");
const messages_1 = require("../messages");
const botExtensions_1 = require("../utils/botExtensions");
exports.default = {
    name: "r",
    description: "Marca como pronto para jogar",
    execute(bot, name, args, message) {
        const state = roomState_1.roomState.getState();
        if (state !== types_1.RoomState.READY) {
            return;
        }
        const playerId = message.player.id;
        const currentMatch = roomState_1.roomState.getCurrentMatch();
        const isInMatch = (currentMatch.picker && currentMatch.picker.id === playerId) ||
            (currentMatch.picked && currentMatch.picked.id === playerId);
        if (!isInMatch) {
            bot.chat(messages_1.MESSAGES.NOT_IN_GAME);
            return;
        }
        const player = roomState_1.roomState.getPlayerById(playerId);
        if (player) {
            player.ready = true;
        }
        let readyCount = 0;
        let totalCount = 0;
        if (currentMatch.picker) {
            totalCount++;
            const pickerInQueue = roomState_1.roomState.getPlayerById(currentMatch.picker.id);
            if (pickerInQueue?.ready)
                readyCount++;
        }
        if (currentMatch.picked) {
            totalCount++;
            const pickedInQueue = roomState_1.roomState.getPlayerById(currentMatch.picked.id);
            if (pickedInQueue?.ready)
                readyCount++;
        }
        bot.chat(messages_1.MESSAGES.PLAYER_READY(player?.username || "Jogador", readyCount, totalCount));
        if (readyCount >= totalCount && totalCount > 0) {
            bot.chat(messages_1.MESSAGES.ALL_READY);
            roomState_1.roomState.clearTimer("ready");
            roomState_1.roomState.setState(types_1.RoomState.GAME_STARTING);
            (async () => {
                try {
                    const started = await (0, botExtensions_1.startGameAsHost)(bot);
                    if (started) {
                        roomState_1.roomState.setState(types_1.RoomState.IN_GAME);
                        console.log("[Game] Partida iniciada (ready + SEND_START_COUNTDOWN)");
                    }
                    else {
                        roomState_1.roomState.setState(types_1.RoomState.IN_GAME);
                        console.warn("[Game] sendMessage não disponível estado atualizado apenas");
                    }
                }
                catch (error) {
                    console.error("[Game] Erro ao iniciar partida:", error);
                    bot.chat("❌ Não foi possível iniciar a partida. O host inicia manualmente.");
                }
            })();
        }
    },
};
