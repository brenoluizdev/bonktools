"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mbappa2x2Mode = exports.MBAPPA_2X2_MODE_ID = void 0;
const bonkRoom_1 = require("../../room/bonkRoom");
const utils_1 = require("./utils");
const modeConfig_1 = require("../../config/modeConfig");
const RED = 2;
const BLUE = 3;
const SPEC = 0;
const PLAYERS_PER_TEAM = 2;
const SCORE_LIMIT = 5;
exports.MBAPPA_2X2_MODE_ID = 'mbappa2x2';
const state = {};
exports.mbappa2x2Mode = {
    id: exports.MBAPPA_2X2_MODE_ID,
    name: 'MBAPPA 2X2',
    getRoomParams(base) {
        const config = (0, modeConfig_1.getModeConfig)(exports.MBAPPA_2X2_MODE_ID);
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
        if (inGame.length !== 4)
            return false;
        const red = inGame.filter(p => p.team === RED).length;
        const blue = inGame.filter(p => p.team === BLUE).length;
        return red === PLAYERS_PER_TEAM && blue === PLAYERS_PER_TEAM;
    },
    async onPlayerJoined(room, player) {
        if (room.getState() !== bonkRoom_1.RoomState.IDLE)
            return;
        const inGame = this.getInGamePlayers(room);
        const alreadyAssigned = inGame.filter(p => p.id !== player.id).length;
        const team = alreadyAssigned % 2 === 0 ? BLUE : RED;
        await room.changeOtherTeam(player.id, team);
        if (alreadyAssigned + 1 < 4) {
            await room.chat('Aguarde mais jogadores para iniciar.');
        }
        else {
            room.setState(bonkRoom_1.RoomState.READY);
            room.startTransitionTimer(60000);
            await room.allReadyReset();
            await room.chat('Todos na sala. Cliquem em Ready ou digitem !r para iniciar.');
        }
    },
    async transitionFromIdle(room) {
        const queue = room.getQueue();
        const inRoom = Array.from(queue.values()).filter(p => p.inRoom);
        const redCount = inRoom.filter(p => p.team === RED).length;
        const blueCount = inRoom.filter(p => p.team === BLUE).length;
        if (inRoom.length >= 4 && redCount === PLAYERS_PER_TEAM && blueCount === PLAYERS_PER_TEAM) {
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
        await room.chat('2v2 ready. Click Ready or type !r to start.');
    },
    async onGameEnd(room, winnerTeam) {
        const queue = room.getQueue();
        const inRoom = Array.from(queue.values()).filter(p => p.inRoom);
        const redPlayers = inRoom.filter(p => p.team === RED);
        const bluePlayers = inRoom.filter(p => p.team === BLUE);
        const specPlayers = inRoom.filter(p => p.team === SPEC);
        let losingTeam;
        if (winnerTeam === RED)
            losingTeam = BLUE;
        else if (winnerTeam === BLUE)
            losingTeam = RED;
        else
            losingTeam = redPlayers.length === 0 ? BLUE : RED;
        const losers = losingTeam === RED
            ? redPlayers
            : bluePlayers;
        if (specPlayers.length === 2) {
            for (const p of losers)
                await room.changeOtherTeam(p.id, SPEC);
            await room.changeOtherTeam(specPlayers[0].id, losingTeam);
            await room.changeOtherTeam(specPlayers[1].id, losingTeam);
            await room.allReadyReset();
            room.setState(bonkRoom_1.RoomState.READY);
            room.startTransitionTimer(60000);
            await room.chat('Subs in. Click Ready or !r to start.');
        }
        else if (specPlayers.length === 1) {
            state.picker = specPlayers[0];
            state.pickable = losers;
            state.losingTeam = losingTeam;
            room.setState(bonkRoom_1.RoomState.PICK);
            room.startTransitionTimer(60000);
            await room.chat(`${specPlayers[0].username}, type !p <abbreviation> to pick your teammate.`);
        }
        else {
            await room.resetToIdle();
        }
    },
    getHelpMessage() {
        return '!help !ping !queue !r !p <name> !reset !cancel';
    },
    async handleCommand(room, playerId, cmd, args) {
        if (cmd !== 'p' && cmd !== 'pick')
            return false;
        if (room.getState() !== bonkRoom_1.RoomState.PICK)
            return false;
        if (!state.picker || state.picker.id !== playerId) {
            await room.chat(`It's ${state.picker?.username ?? 'someone'}'s turn to pick.`);
            return true;
        }
        if (!state.pickable?.length || !state.losingTeam) {
            await room.chat("No one to pick.");
            return true;
        }
        const query = args.join(' ').trim();
        const names = state.pickable.map(p => p.username);
        const matches = (0, utils_1.fuzzyMatch)(query, names);
        if (matches.length !== 1) {
            await room.chat("Type !p <abbreviation> of one player. One match only.");
            return true;
        }
        const pickedName = matches[0];
        const picked = state.pickable.find(p => p.username === pickedName);
        if (!picked)
            return true;
        await room.changeOtherTeam(state.picker.id, state.losingTeam);
        await room.changeOtherTeam(picked.id, state.losingTeam);
        state.picker = undefined;
        state.pickable = undefined;
        state.losingTeam = undefined;
        await room.allReadyReset();
        room.setState(bonkRoom_1.RoomState.READY);
        room.startTransitionTimer(60000);
        await room.chat('Click Ready or !r to start.');
        return true;
    },
};
