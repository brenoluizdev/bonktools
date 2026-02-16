"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomState_1 = require("../state/roomState");
const types_1 = require("../state/types");
const messages_1 = require("../messages");
const joinTeam_types_1 = require("../types/joinTeam.types");
const botExtensions_1 = require("../utils/botExtensions");
exports.default = {
    name: "p",
    description: "Escolhe um adversário (quando for sua vez)",
    execute(bot, name, args, message) {
        const state = roomState_1.roomState.getState();
        // Só funciona no estado PICK
        if (state !== types_1.RoomState.PICK) {
            bot.chat(messages_1.MESSAGES.COMMAND_NOT_FOUND);
            return;
        }
        const playerId = message.player.id;
        const currentMatch = roomState_1.roomState.getCurrentMatch();
        // Verifica se é a vez deste jogador
        if (!currentMatch.picker || currentMatch.picker.id !== playerId) {
            if (currentMatch.picker) {
                bot.chat(messages_1.MESSAGES.NOT_YOUR_TURN(currentMatch.picker.username));
            }
            return;
        }
        // Pega o nome do adversário (resto dos args)
        const opponentQuery = args.join(" ").trim();
        if (!opponentQuery) {
            bot.chat(messages_1.MESSAGES.USE_PICK_COMMAND);
            return;
        }
        // Busca jogadores por nome (fuzzy)
        const matches = roomState_1.roomState.findPlayersByName(opponentQuery);
        // Remove o picker dos matches
        const validMatches = matches.filter(p => p.id !== playerId);
        if (validMatches.length === 0) {
            bot.chat(messages_1.MESSAGES.NO_MATCH_FOUND);
            return;
        }
        if (validMatches.length > 1) {
            bot.chat(messages_1.MESSAGES.MULTIPLE_MATCHES);
            const names = validMatches.map(p => p.username).join(", ");
            bot.chat(`Jogadores encontrados: ${names}`);
            return;
        }
        // Match único!
        const picked = validMatches[0];
        roomState_1.roomState.setPicked(picked);
        bot.chat(messages_1.MESSAGES.PLAYER_PICKED(currentMatch.picker.username, picked.username));
        bot.chat(messages_1.MESSAGES.MATCH_STARTING(currentMatch.picker.username, picked.username));
        // Colocar jogadores em times usando CHANGE_OTHER_TEAM
        (async () => {
            try {
                // Picker vai para time 2 (RED), picked vai para time 3 (BLUE)
                await (0, botExtensions_1.changeOtherTeam)(bot, currentMatch.picker.id, joinTeam_types_1.JoinTeam.RED);
                await new Promise(r => setTimeout(r, 100));
                await (0, botExtensions_1.changeOtherTeam)(bot, picked.id, joinTeam_types_1.JoinTeam.BLUE);
                await new Promise(r => setTimeout(r, 200));
                console.log(`[Pick] Times configurados: ${currentMatch.picker.username}=RED, ${picked.username}=BLUE`);
                // Avançar para o estado READY
                roomState_1.roomState.setState(types_1.RoomState.READY);
                roomState_1.roomState.clearTimer("pick");
                bot.chat(messages_1.MESSAGES.USE_READY_COMMAND);
                // Timer para ready
                const { TIMEOUTS } = require("../config/room");
                roomState_1.roomState.startTimer("ready", () => {
                    bot.chat(messages_1.MESSAGES.READY_TIMEOUT);
                    roomState_1.roomState.reset();
                    // Tentar iniciar próxima partida
                    const { tryStartNextMatch } = require("../state/transitions");
                    tryStartNextMatch(bot);
                }, TIMEOUTS.READY_TIME);
            }
            catch (error) {
                console.error("[Pick] Erro ao configurar times:", error);
                bot.chat("❌ Erro ao configurar times. Entrem manualmente nos times (vermelho/azul).");
            }
        })();
    },
};
