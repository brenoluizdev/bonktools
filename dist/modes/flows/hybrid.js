"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHybridMode = createHybridMode;
const bonkRoom_1 = require("../../room/bonkRoom");
const modeConfig_1 = require("../../config/modeConfig");
const RED = 2;
const BLUE = 3;
const SPEC = 0;
const PLAYERS_PER_TEAM = 2;
function createHybridMode(modeId) {
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
                teams: config.teams,
            };
        },
        getInGamePlayers(room) {
            const queue = room.getQueue();
            return Array.from(queue.values()).filter(p => p.inRoom && (p.team === RED || p.team === BLUE));
        },
        canStart(room) {
            const inGame = this.getInGamePlayers(room);
            if (inGame.length === 2) {
                const red = inGame.filter(p => p.team === RED).length;
                const blue = inGame.filter(p => p.team === BLUE).length;
                return red === 1 && blue === 1;
            }
            if (inGame.length === 4) {
                const red = inGame.filter(p => p.team === RED).length;
                const blue = inGame.filter(p => p.team === BLUE).length;
                return red === PLAYERS_PER_TEAM && blue === PLAYERS_PER_TEAM;
            }
            return false;
        },
        async onPlayerJoined(room, player) {
            if (room.getState() !== bonkRoom_1.RoomState.IDLE)
                return;
            const inGame = this.getInGamePlayers(room);
            const alreadyAssigned = inGame.filter(p => p.id !== player.id).length;
            const team = alreadyAssigned % 2 === 0 ? BLUE : RED;
            await room.changeOtherTeam(player.id, team);
            const total = alreadyAssigned + 1;
            if (total < 2) {
                await room.chat('Aguarde mais jogadores para iniciar.');
            }
            else if (total === 2) {
                room.setState(bonkRoom_1.RoomState.READY);
                room.startTransitionTimer(60000);
                await room.allReadyReset();
                await room.chat('1v1. Cliquem em Ready ou !r para iniciar.');
            }
            else if (total < 4) {
                await room.chat('Aguarde 4 jogadores para 2v2 ou 2 para 1v1.');
            }
            else {
                room.setState(bonkRoom_1.RoomState.READY);
                room.startTransitionTimer(60000);
                await room.allReadyReset();
                await room.chat('2v2. Cliquem em Ready ou !r para iniciar.');
            }
        },
        async transitionFromIdle(room) {
            const inGame = this.getInGamePlayers(room);
            const redCount = inGame.filter(p => p.team === RED).length;
            const blueCount = inGame.filter(p => p.team === BLUE).length;
            if (inGame.length === 2 && redCount === 1 && blueCount === 1) {
                await this.startMapSelection(room);
            }
            else if (inGame.length === 4 && redCount === 2 && blueCount === 2) {
                await this.startMapSelection(room);
            }
            else {
                room.startTransitionTimer(5000);
            }
        },
        async startMapSelection(room) {
            const inGame = this.getInGamePlayers(room);
            room.setState(bonkRoom_1.RoomState.READY);
            room.startTransitionTimer(60000);
            await room.allReadyReset();
            if (inGame.length === 2) {
                await room.chat('1v1 pronto. Cliquem em Ready ou !r para iniciar.');
            }
            else {
                await room.chat('2v2 pronto. Cliquem em Ready ou !r para iniciar.');
            }
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
