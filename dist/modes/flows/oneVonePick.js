"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create1v1PickMode = create1v1PickMode;
const bonkRoom_1 = require("../../room/bonkRoom");
const modeConfig_1 = require("../../config/modeConfig");
const utils_1 = require("../mbappa2x2/utils");
const RED = 2;
const BLUE = 3;
const SPEC = 0;
const pickStateByMode = new Map();
function getState(modeId) {
    let s = pickStateByMode.get(modeId);
    if (!s) {
        s = {};
        pickStateByMode.set(modeId, s);
    }
    return s;
}
function create1v1PickMode(modeId) {
    const config = (0, modeConfig_1.getModeConfig)(modeId);
    const state = () => getState(modeId);
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
            if (inGame.length !== 2)
                return false;
            const red = inGame.filter(p => p.team === RED).length;
            const blue = inGame.filter(p => p.team === BLUE).length;
            return red === 1 && blue === 1;
        },
        async onPlayerJoined(room, player) {
            if (room.getState() !== bonkRoom_1.RoomState.IDLE)
                return;
            const inGame = this.getInGamePlayers(room);
            const alreadyAssigned = inGame.filter(p => p.id !== player.id).length;
            const team = alreadyAssigned % 2 === 0 ? BLUE : RED;
            await room.changeOtherTeam(player.id, team);
            if (alreadyAssigned + 1 < 2) {
                await room.chat('Aguarde mais um jogador para iniciar.');
            }
            else {
                room.setState(bonkRoom_1.RoomState.READY);
                room.startTransitionTimer(60000);
                await room.allReadyReset();
                await room.chat('Cliquem em Ready ou digitem !r para iniciar.');
            }
        },
        async transitionFromIdle(room) {
            const inGame = this.getInGamePlayers(room);
            const redCount = inGame.filter(p => p.team === RED).length;
            const blueCount = inGame.filter(p => p.team === BLUE).length;
            if (inGame.length >= 2 && redCount === 1 && blueCount === 1) {
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
            await room.chat('1v1 pronto. Cliquem em Ready ou !r para iniciar.');
        },
        async onGameEnd(room, winnerTeam) {
            const queue = room.getQueue();
            const inRoom = Array.from(queue.values()).filter(p => p.inRoom);
            const inGame = inRoom.filter(p => p.team === RED || p.team === BLUE);
            const specPlayers = inRoom.filter(p => p.team === SPEC);
            if (specPlayers.length === 1 && inGame.length === 2) {
                const s = state();
                s.picker = specPlayers[0];
                s.pickable = [...inGame];
                room.setState(bonkRoom_1.RoomState.PICK);
                room.startTransitionTimer(60000);
                await room.chat(`${specPlayers[0].username}, digite !p <abreviação> para escolher quem enfrentar.`);
            }
            else {
                await room.resetToIdle();
            }
        },
        getHelpMessage() {
            return '!help !ping !queue !r !p <jogador> !reset !cancel';
        },
        async handleCommand(room, playerId, cmd, args) {
            if (cmd !== 'p' && cmd !== 'pick')
                return false;
            if (room.getState() !== bonkRoom_1.RoomState.PICK)
                return false;
            const s = state();
            if (!s.picker || s.picker.id !== playerId) {
                await room.chat(`É a vez de ${s.picker?.username ?? 'alguém'} escolher.`);
                return true;
            }
            if (!s.pickable?.length) {
                await room.chat('Ninguém para escolher.');
                return true;
            }
            const query = args.join(' ').trim();
            const names = s.pickable.map(p => p.username);
            const matches = (0, utils_1.fuzzyMatch)(query, names);
            if (matches.length !== 1) {
                await room.chat('Digite !p <abreviação> de um jogador. Apenas uma correspondência.');
                return true;
            }
            const pickedName = matches[0];
            const picked = s.pickable.find(p => p.username === pickedName);
            if (!picked)
                return true;
            const pickerTeam = picked.team === RED ? BLUE : RED;
            await room.changeOtherTeam(s.picker.id, pickerTeam);
            s.picker = undefined;
            s.pickable = undefined;
            await room.allReadyReset();
            room.setState(bonkRoom_1.RoomState.READY);
            room.startTransitionTimer(60000);
            await room.chat('Cliquem em Ready ou !r para iniciar.');
            return true;
        },
    };
}
