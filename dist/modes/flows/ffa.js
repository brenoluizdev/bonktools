"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFfaMode = createFfaMode;
const bonkRoom_1 = require("../../room/bonkRoom");
const modeConfig_1 = require("../../config/modeConfig");
/**
 * FFA: sem times, todos jogam. Quando um jogador entra, o bot espera um ponto;
 * após um ponto/vencedor, adiciona o jogador em tempo real (sem voltar ao lobby).
 * Round to win vem da config.
 */
function createFfaMode(modeId) {
    const config = (0, modeConfig_1.getModeConfig)(modeId);
    return {
        id: modeId,
        name: config.name,
        getRoomParams(base) {
            return {
                name: base.name ?? config.name,
                password: base.password ?? '',
                maxPlayers: base.maxPlayers ?? 8,
                minLevel: base.minLevel ?? 0,
                unlisted: base.unlisted ?? false,
                mode: config.gameMode,
                rounds: config.rounds,
                maps: base.maps ?? [],
                teams: false,
            };
        },
        getInGamePlayers(room) {
            const queue = room.getQueue();
            return Array.from(queue.values()).filter(p => p.inRoom);
        },
        canStart(room) {
            const inGame = this.getInGamePlayers(room);
            return inGame.length >= 1;
        },
        async onPlayerJoined(room) {
            if (room.getState() !== bonkRoom_1.RoomState.IDLE)
                return;
            const inGame = this.getInGamePlayers(room);
            if (inGame.length >= 1) {
                room.setState(bonkRoom_1.RoomState.READY);
                room.startTransitionTimer(60000);
                await room.allReadyReset();
                await room.chat('Novo jogador na fila. Após o próximo ponto, entre na partida. Cliquem em Ready ou !r.');
            }
        },
        async transitionFromIdle(room) {
            const inGame = this.getInGamePlayers(room);
            if (inGame.length >= 1) {
                await this.startMapSelection(room);
            }
            else {
                room.startTransitionTimer(5000);
            }
        },
        async startMapSelection(room) {
            room.setState(bonkRoom_1.RoomState.READY);
            room.startTransitionTimer(60000);
            await room.allReadyReset();
            await room.chat('Corrida de Cart. Cliquem em Ready ou !r para iniciar.');
        },
        async onGameEnd(room) {
            await room.resetToIdle();
        },
        getHelpMessage() {
            return '!help !ping !queue !r !reset !cancel';
        },
        async handleCommand() {
            return false;
        },
    };
}
