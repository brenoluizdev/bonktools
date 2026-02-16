"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonkRoom = exports.RoomState = void 0;
const DEBUG_LOG = process.env.BONK_DEBUG === '1' || process.env.BONK_DEBUG === 'true';
function logDebug(tag, data) {
    if (!DEBUG_LOG)
        return;
    const line = Object.entries(data)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');
    console.log(`[BonkRoom:LOG] ${tag} | ${line}`);
}
var RoomState;
(function (RoomState) {
    RoomState["IDLE"] = "idle";
    RoomState["PICK"] = "pick";
    RoomState["MAP_SELECTION"] = "mapSelection";
    RoomState["READY"] = "ready";
    RoomState["GAME_STARTING"] = "gameStarting";
    RoomState["IN_GAME"] = "inGame";
})(RoomState || (exports.RoomState = RoomState = {}));
class BonkRoom {
    constructor(browser, page, params, mode) {
        this.state = RoomState.IDLE;
        this.queue = new Map();
        this.updateTickCount = 0;
        this.voteReset = [];
        this.voteCancel = [];
        this.newPlayersThisTick = [];
        this.chatUnavailableLogged = false;
        this.gameFrameCache = null;
        this.browser = browser;
        this.page = page;
        this.params = params;
        this.mode = mode;
    }
    getRoomForMode() {
        return {
            getState: () => this.state,
            setState: (s) => { this.state = s; },
            getQueue: () => this.queue,
            chat: (msg) => this.chat(msg),
            getGameFrame: () => this.getGameFrame(),
            changeOtherTeam: (id, team) => this.changeOtherTeam(id, team),
            allReadyReset: () => this.allReadyReset(),
            loadMap: (mapJson) => this.loadMap(mapJson),
            startGame: () => this.startGame(),
            getPicker: () => this.picker,
            setPicker: (p) => { this.picker = p; },
            getPicked: () => this.picked,
            setPicked: (p) => { this.picked = p; },
            startTransitionTimer: (ms) => this.startTransitionTimer(ms),
            clearTransitionTimer: () => this.clearTransitionTimer(),
            getVoteReset: () => this.voteReset,
            setVoteReset: (ids) => { this.voteReset = ids; },
            getVoteCancel: () => this.voteCancel,
            setVoteCancel: (ids) => { this.voteCancel = ids; },
            resetToIdle: () => this.reset(),
        };
    }
    async run() {
        console.log('[BonkRoom] 🎮 Iniciando gerenciamento da sala...');
        console.log('[BonkRoom] Estado inicial: IDLE');
        if (DEBUG_LOG)
            console.log('[BonkRoom:LOG] Log detalhado ativado (BONK_DEBUG).');
        this.updateInterval = setInterval(() => {
            this.update().catch(err => {
                console.error('[BonkRoom] ❌ Erro no update:', err);
            });
        }, 250);
        this.startTransitionTimer(5000);
        console.log('[BonkRoom] ✅ Loop iniciado');
        console.log('[BonkRoom] Aguardando jogadores entrarem...');
        if (DEBUG_LOG) {
            setTimeout(async () => {
                try {
                    const frame = await this.getGameFrame();
                    if (!frame)
                        return;
                    const diag = await frame.evaluate(() => {
                        const buf = window.messageBuffer;
                        const onRecv = window.sgrAPI?.onReceive;
                        return {
                            hasMessageBuffer: Array.isArray(buf),
                            onReceiveType: typeof onRecv,
                            hasSgrAPI: typeof window.sgrAPI !== 'undefined',
                        };
                    });
                    console.log('[BonkRoom] 📡 Diagnóstico chat:', diag);
                }
                catch (e) {
                    console.log('[BonkRoom] 📡 Diagnóstico chat (erro):', e.message);
                }
            }, 1500);
        }
    }
    async update() {
        this.updateTickCount += 1;
        const tick = this.updateTickCount;
        try {
            const frame = await this.getGameFrame();
            if (!frame) {
                if (DEBUG_LOG && tick % 20 === 1)
                    logDebug('update', { event: 'frame_null', state: this.state });
                return;
            }
            const players = await frame.evaluate(() => {
                const sgr = window.sgrAPI;
                if (typeof sgr === 'undefined')
                    return { error: 'no_sgrAPI', players: [] };
                if (sgr.players == null)
                    return { error: 'sgrAPI.players_null', players: [] };
                try {
                    return { error: null, players: sgr.getPlayers() };
                }
                catch (e) {
                    return { error: String(e), players: [] };
                }
            });
            const playerList = Array.isArray(players) ? players : players.players ?? [];
            const playerError = Array.isArray(players) ? null : players.error ?? null;
            if (playerError && DEBUG_LOG && tick % 20 === 1) {
                logDebug('getPlayers', { error: playerError, state: this.state });
            }
            const inGameBefore = this.getInGamePlayers();
            const prevReady = new Map(inGameBefore.map(p => [p.id, p.ready]));
            this.newPlayersThisTick = [];
            this.updateQueue(playerList);
            if (this.mode.onPlayerJoined && this.newPlayersThisTick.length > 0) {
                for (const player of this.newPlayersThisTick) {
                    await this.mode.onPlayerJoined(this.getRoomForMode(), player);
                }
            }
            if (this.state === RoomState.READY || this.state === RoomState.MAP_SELECTION) {
                const inGameAfter = this.getInGamePlayers();
                const justBecameReady = inGameAfter.some(p => p.ready && !prevReady.get(p.id));
                if (justBecameReady)
                    await this.checkReady(true);
            }
            const messages = await frame.evaluate(() => {
                // @ts-ignore
                const msgs = window.messageBuffer || [];
                // @ts-ignore
                window.messageBuffer = [];
                return msgs;
            });
            for (const msg of messages) {
                await this.onMessage(msg);
            }
            await this.detectStateChanges(frame);
            if (DEBUG_LOG && tick % 20 === 0) {
                let frameUrl = '(cached)';
                try {
                    frameUrl = frame.url();
                }
                catch {
                    frameUrl = '(detached?)';
                }
                logDebug('status', {
                    state: this.state,
                    frameUrl: frameUrl.slice(0, 60),
                    playersFromSgr: playerList.length,
                    playerIds: playerList.map((p) => p.id ?? p.userName ?? p.username),
                    queueSize: this.queue.size,
                    messagesCount: Array.isArray(messages) ? messages.length : 0,
                });
            }
        }
        catch (error) {
            if (error instanceof Error && !error.message.includes('Execution context')) {
                console.error('[BonkRoom] Erro no update:', error);
                if (DEBUG_LOG)
                    logDebug('update_error', { message: error.message, state: this.state });
            }
        }
    }
    updateQueue(players) {
        const botUsername = process.env.BOT_USERNAME || 'FUTHERO BOT';
        const now = Date.now();
        const name = (p) => p.userName ?? p.username ?? String(p.id);
        for (const p of players) {
            if (name(p) === botUsername)
                continue;
            const existing = this.queue.get(p.id);
            if (existing) {
                existing.team = p.team;
                existing.ready = p.ready;
                existing.inRoom = true;
                existing.lastSeen = now;
            }
            else {
                const newPlayer = {
                    id: p.id,
                    username: name(p),
                    team: p.team,
                    ready: p.ready,
                    readyCmd: false,
                    inRoom: true,
                    lastSeen: now,
                };
                this.queue.set(p.id, newPlayer);
                this.newPlayersThisTick.push(newPlayer);
                console.log(`[BonkRoom] ➕ ${name(p)} entrou na sala (ID: ${p.id})`);
            }
        }
        const currentIds = new Set(players.map(p => p.id));
        for (const [id, player] of this.queue.entries()) {
            if (!currentIds.has(id) && player.inRoom) {
                if (now - player.lastSeen > 60000) {
                    player.inRoom = false;
                    console.log(`[BonkRoom] ➖ ${player.username} saiu da sala`);
                }
            }
        }
    }
    parseCommand(text) {
        const normalized = text.startsWith('|') ? '!' + text.slice(1) : text;
        if (!normalized.startsWith('!'))
            return null;
        const parts = normalized.slice(1).trim().split(/\s+/);
        return { cmd: (parts[0] || '').toLowerCase(), args: parts.slice(1) };
    }
    async onMessage(message) {
        let match = message.match(/42\[20,(\d+),"((?:[^"\\]|\\.)*)"\]/);
        if (!match) {
            match = message.match(/42\[20,(\d+),(.+)\]/);
            if (match) {
                let text = match[2];
                if (text.startsWith('"') && text.endsWith('"'))
                    text = text.slice(1, -1).replace(/\\"/g, '"');
                match = [match[0], match[1], text];
            }
        }
        if (!match)
            return;
        const playerId = parseInt(match[1]);
        if (playerId === 0)
            return;
        const text = (match[2] ?? '').trim();
        if (text.includes('!test') || text.includes('|test')) {
            await this.handleTestCommand(playerId, text);
            return;
        }
        const parsed = this.parseCommand(text);
        if (!parsed)
            return;
        const { cmd, args } = parsed;
        const room = this.getRoomForMode();
        switch (cmd) {
            case 'r':
            case 'ready':
                await this.handleReadyCommand(playerId);
                break;
            case 'help':
            case 'h':
            case '?':
                await this.chat(this.mode.getHelpMessage());
                break;
            case 'ping':
                await this.chat('Pong!');
                break;
            case 'q':
            case 'queue':
                await this.handleQueueCommand();
                break;
            case 'd':
            case 'discord':
                await this.handleDiscordCommand();
                break;
            case 're':
            case 'reset':
                await this.handleResetCommand(playerId);
                break;
            case 'c':
            case 'cancel':
                await this.handleCancelCommand(playerId);
                break;
            default: {
                const handled = await this.mode.handleCommand(room, playerId, cmd, args);
                if (!handled)
                    await this.chat(this.mode.getHelpMessage());
                break;
            }
        }
    }
    async handleTestCommand(playerId, _text) {
        const player = this.queue.get(playerId);
        const name = player?.username ?? `ID ${playerId}`;
        console.log(`[BonkRoom] 🧪 !test recebido de ${name} — integração OK`);
        await this.chat('Integração OK! Bot está recebendo comandos.');
    }
    async handleReadyCommand(playerId) {
        if (this.state !== RoomState.READY && this.state !== RoomState.MAP_SELECTION)
            return;
        const player = this.queue.get(playerId);
        if (!player)
            return;
        player.readyCmd = true;
        console.log(`[BonkRoom] ✅ ${player.username} está pronto (!r)`);
        await this.checkReady(true);
    }
    async handleQueueCommand() {
        const names = Array.from(this.queue.values())
            .filter(p => p.inRoom)
            .map(p => p.username);
        await this.chat(names.length ? names.join(', ') : 'Queue is empty.');
    }
    async handleDiscordCommand() {
        const link = process.env.DISCORD_SERVER_LINK;
        if (link)
            await this.chat(link);
    }
    async handleResetCommand(playerId) {
        if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME)
            return;
        const inGame = this.getInGamePlayers();
        if (!inGame.some(p => p.id === playerId))
            return;
        if (this.voteReset.includes(playerId))
            return;
        this.voteReset.push(playerId);
        if (this.voteReset.length < inGame.length) {
            await this.chat(`${this.voteReset.length}/${inGame.length} players voted for reset.`);
        }
        else {
            this.voteReset = [];
            const frame = await this.getGameFrame();
            if (frame) {
                await frame.evaluate(() => {
                    const sgr = window.sgrAPI;
                    if (!sgr)
                        return;
                    if (sgr.nextScores !== undefined)
                        sgr.nextScores = sgr.state?.scores ?? sgr.footballState?.scores;
                    if (typeof sgr.startGame === 'function')
                        sgr.startGame();
                });
            }
        }
    }
    async handleCancelCommand(playerId) {
        if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME)
            return;
        const inGame = this.getInGamePlayers();
        if (!inGame.some(p => p.id === playerId))
            return;
        if (this.voteCancel.includes(playerId))
            return;
        this.voteCancel.push(playerId);
        if (this.voteCancel.length < inGame.length) {
            await this.chat(`${this.voteCancel.length}/${inGame.length} players voted to cancel.`);
        }
        else {
            await this.reset();
        }
    }
    async checkReady(showChat) {
        const inGame = this.getInGamePlayers();
        const readyCount = inGame.filter(p => p.ready || p.readyCmd).length;
        const canStart = this.mode.canStart(this.getRoomForMode());
        if (readyCount >= inGame.length && inGame.length > 0 && canStart) {
            console.log('[BonkRoom] 🎯 Todos prontos! Iniciando partida...');
            this.voteReset = [];
            this.voteCancel = [];
            await this.startGame();
            this.clearTransitionTimer();
            this.state = RoomState.GAME_STARTING;
            console.log('[BonkRoom] 🚀 Estado: GAME_STARTING');
        }
        else if (showChat && inGame.length > 0) {
            await this.chat(`${readyCount}/${inGame.length} players ready.`);
        }
    }
    getInGamePlayers() {
        return this.mode.getInGamePlayers(this.getRoomForMode());
    }
    async changeOtherTeam(playerId, team) {
        const frame = await this.getGameFrame();
        if (!frame)
            return false;
        try {
            const ok = await frame.evaluate((id, t) => {
                const sgr = window.sgrAPI;
                if (!sgr?.toolFunctions?.networkEngine?.changeOtherTeam)
                    return false;
                sgr.toolFunctions.networkEngine.changeOtherTeam(id, t);
                return true;
            }, playerId, team);
            return !!ok;
        }
        catch {
            return false;
        }
    }
    async allReadyReset() {
        const frame = await this.getGameFrame();
        if (!frame)
            return;
        try {
            await frame.evaluate(() => {
                const sgr = window.sgrAPI;
                if (sgr?.toolFunctions?.networkEngine?.allReadyReset)
                    sgr.toolFunctions.networkEngine.allReadyReset();
            });
        }
        catch (_) { }
    }
    async loadMap(mapJson) {
        const frame = await this.getGameFrame();
        if (!frame)
            return;
        try {
            await frame.evaluate((json) => {
                const sgr = window.sgrAPI;
                if (sgr?.loadMap)
                    sgr.loadMap(JSON.parse(json));
            }, mapJson);
        }
        catch (_) { }
    }
    async startGame() {
        const frame = await this.getGameFrame();
        if (!frame)
            return;
        await frame.evaluate(() => {
            const sgr = window.sgrAPI;
            if (sgr?.startGame)
                sgr.startGame();
        });
    }
    async detectStateChanges(frame) {
        if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME)
            return;
        const inLobby = await frame.evaluate(() => {
            const lobby = document.getElementById('newbonklobby');
            return lobby && lobby.style.opacity === '1';
        });
        if (DEBUG_LOG && this.updateTickCount % 20 === 0) {
            logDebug('detectStateChanges', { state: this.state, inLobby });
        }
        if (this.state === RoomState.GAME_STARTING && !inLobby) {
            this.state = RoomState.IN_GAME;
            console.log('[BonkRoom] ✅ Partida iniciada! Estado: IN_GAME');
        }
        if (this.state === RoomState.IN_GAME && inLobby) {
            console.log('[BonkRoom] 🏁 Partida terminou');
            let winnerTeam;
            try {
                const scores = await frame.evaluate(() => {
                    const sgr = window.sgrAPI;
                    const s = sgr?.footballState?.scores ?? sgr?.state?.scores;
                    if (!s)
                        return null;
                    const red = s[2] ?? 0;
                    const blue = s[3] ?? 0;
                    return { red, blue };
                });
                if (scores && scores.red !== scores.blue) {
                    winnerTeam = scores.red > scores.blue ? 2 : 3;
                }
            }
            catch (_) { }
            await this.mode.onGameEnd(this.getRoomForMode(), winnerTeam);
        }
    }
    async chat(message) {
        try {
            const frame = await this.getGameFrame();
            if (!frame)
                return;
            const ok = await frame.evaluate((msg) => {
                const sgr = window.sgrAPI;
                if (sgr?.toolFunctions?.networkEngine?.chatMessage) {
                    sgr.toolFunctions.networkEngine.chatMessage(msg);
                    return true;
                }
                return false;
            }, message);
            if (ok)
                this.chatUnavailableLogged = false;
            else if (!this.chatUnavailableLogged) {
                this.chatUnavailableLogged = true;
                console.warn('[BonkRoom] ⚠️ Chat não enviado: networkEngine ausente.');
            }
        }
        catch (_) {
            // Ignorar
        }
    }
    async reset() {
        console.log('[BonkRoom] 🔄 Resetando sala...');
        this.state = RoomState.IDLE;
        this.picker = undefined;
        this.picked = undefined;
        this.voteReset = [];
        this.voteCancel = [];
        for (const player of this.queue.values()) {
            player.readyCmd = false;
        }
        const frame = await this.getGameFrame();
        if (frame) {
            try {
                await frame.evaluate(() => {
                    const sgr = window.sgrAPI;
                    if (sgr?.toolFunctions?.networkEngine?.allReadyReset)
                        sgr.toolFunctions.networkEngine.allReadyReset();
                });
            }
            catch (_) { }
        }
        this.startTransitionTimer(5000);
        console.log('[BonkRoom] Estado: IDLE');
        console.log('[BonkRoom] Aguardando próximos jogadores...');
    }
    startTransitionTimer(duration) {
        this.clearTransitionTimer();
        this.transitionTimer = setTimeout(async () => {
            await this.onTransitionTimerExpired();
        }, duration);
    }
    clearTransitionTimer() {
        if (this.transitionTimer) {
            clearTimeout(this.transitionTimer);
            this.transitionTimer = undefined;
        }
    }
    async onTransitionTimerExpired() {
        if (this.state === RoomState.IDLE) {
            await this.transitionFromIdle();
        }
        else if (this.state === RoomState.READY || this.state === RoomState.PICK) {
            console.log('[BonkRoom] ⏰ Tempo expirou, resetando...');
            await this.reset();
        }
    }
    async transitionFromIdle() {
        await this.mode.transitionFromIdle(this.getRoomForMode());
    }
    async startMapSelection() {
        await this.mode.startMapSelection(this.getRoomForMode());
        await this.checkReady(false);
    }
    async getGameFrame() {
        if (this.gameFrameCache) {
            try {
                await this.gameFrameCache.evaluate(() => window.sgrAPI != null);
                return this.gameFrameCache;
            }
            catch {
                if (DEBUG_LOG)
                    logDebug('getGameFrame', { event: 'cache_invalid', reason: 'evaluate_failed' });
                this.gameFrameCache = null;
            }
        }
        const frames = this.page.frames();
        for (const frame of frames) {
            try {
                const info = await frame.evaluate(() => {
                    const hasSgr = typeof window.sgrAPI !== 'undefined';
                    const hasLobby = document.getElementById('newbonklobby') != null;
                    const url = window.location?.href ?? '';
                    return { hasSgr, hasLobby, ok: hasSgr && hasLobby, url };
                });
                if (info.ok) {
                    this.gameFrameCache = frame;
                    if (DEBUG_LOG)
                        logDebug('getGameFrame', { event: 'found_lobby_sgr', url: info.url?.slice(0, 55), framesCount: frames.length });
                    return frame;
                }
            }
            catch (e) {
                continue;
            }
        }
        const fallback = frames.find(f => f.url().includes('gameframe') && f.url().includes('bonk.io'))
            || frames.find(f => f.url().includes('bonk.io'));
        if (fallback) {
            this.gameFrameCache = fallback;
            if (DEBUG_LOG)
                logDebug('getGameFrame', { event: 'fallback_url', url: fallback.url()?.slice(0, 55) });
        }
        else if (DEBUG_LOG) {
            logDebug('getGameFrame', { event: 'no_frame', framesCount: frames.length, urls: frames.map((f) => f.url?.()?.slice(0, 40)) });
        }
        return fallback;
    }
    async close() {
        console.log('[BonkRoom] 🛑 Fechando sala...');
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.clearTransitionTimer();
        try {
            await this.chat('Room closed.');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            // Ignorar erros ao fechar
        }
        await this.browser.close();
        console.log('[BonkRoom] ✅ Sala fechada');
    }
    getDebugInfo() {
        return {
            state: this.state,
            queueSize: this.queue.size,
            queuePlayers: Array.from(this.queue.values())
                .filter(p => p.inRoom)
                .map(p => p.username),
            match: {
                picker: this.picker?.username,
                picked: this.picked?.username,
            },
        };
    }
}
exports.BonkRoom = BonkRoom;
