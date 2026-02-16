"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomMaker = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class RoomMaker {
    constructor() {
        this.injectorScript = '';
        this.sgrApiScript = '';
    }
    async init() {
        const projectRoot = path_1.default.join(__dirname, '..', '..');
        try {
            this.injectorScript = await promises_1.default.readFile(path_1.default.join(projectRoot, 'dependencies', 'CondensedInjector.js'), 'utf-8');
            this.sgrApiScript = await promises_1.default.readFile(path_1.default.join(projectRoot, 'dependencies', 'sgrAPI.user.js'), 'utf-8');
            console.log('[RoomMaker] ✅ Scripts carregados');
        }
        catch (error) {
            console.error('[RoomMaker] ❌ Erro ao carregar scripts:');
            console.error('Certifique-se de que os arquivos estão em dependencies/');
            console.error('- CondensedInjector.js');
            console.error('- sgrAPI.user.js');
            throw error;
        }
    }
    async createRoom(params) {
        console.log('[RoomMaker] 🚀 Iniciando criação da sala...');
        if (this.lastRoomTime) {
            const elapsed = Date.now() - this.lastRoomTime;
            const waitTime = 5000 - elapsed;
            if (waitTime > 0) {
                console.log(`[RoomMaker] ⏳ Aguardando ${waitTime}ms (rate limit)...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        // 1. Abrir navegador
        const browser = await this.launchBrowser();
        const page = await browser.newPage();
        // Configurar timeout padrão
        page.setDefaultTimeout(30000);
        try {
            console.log('[RoomMaker] 📜 Registrando scripts (evaluateOnNewDocument)...');
            const injectorWithHeadCheck = '(function run(){ if(!document.head){ setTimeout(run,10); return; }\n' + this.injectorScript + '\n})();';
            await page.evaluateOnNewDocument(injectorWithHeadCheck);
            await page.evaluateOnNewDocument(this.sgrApiScript);
            console.log('[RoomMaker] 🌐 Navegando para Bonk.io...');
            page.goto('https://bonk.io/', { waitUntil: 'domcontentloaded' }).catch(() => { });
            console.log('[RoomMaker] 🎮 Entrando no frame do jogo...');
            const frameHandle = await page.waitForSelector('#maingameframe', { timeout: 10000 });
            const frame = await frameHandle.contentFrame();
            if (!frame)
                throw new Error('Frame do jogo não encontrado');
            await this.login(frame);
            await this.createGameRoom(frame, params);
            const roomLink = await this.getRoomLink(frame);
            await this.configureRoom(page, frame, params);
            console.log(`[RoomMaker] ✅ Sala criada com sucesso: ${roomLink}`);
            this.lastRoomTime = Date.now();
            return { browser, page, roomLink, maps: params.maps };
        }
        catch (error) {
            console.error('[RoomMaker] ❌ Erro ao criar sala:', error);
            await browser.close();
            throw error;
        }
    }
    async launchBrowser() {
        const headless = process.env.HEADLESS === '1' || process.env.HEADLESS === 'true';
        console.log(`[RoomMaker] 🌐 Abrindo navegador (headless: ${headless})...`);
        return await puppeteer_1.default.launch({
            headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080'
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        });
    }
    async retry(operation, maxDurationMs = 10000, intervalMs = 250) {
        const start = Date.now();
        let lastError = null;
        while (Date.now() - start < maxDurationMs) {
            try {
                return await operation();
            }
            catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }
        throw lastError ?? new Error('Retry timeout');
    }
    async safeClick(frame, selector, waitMs = 500) {
        await frame.waitForSelector(selector, { timeout: 10000, visible: true });
        await new Promise(resolve => setTimeout(resolve, waitMs));
        try {
            await frame.click(selector);
        }
        catch {
            await frame.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el)
                    el.click();
            }, selector);
        }
    }
    async login(frame) {
        console.log('[RoomMaker] 🔐 Fazendo login...');
        const username = process.env.BOT_USERNAME || 'FUTHERO BOT';
        const password = process.env.BOT_PASSWORD;
        if (!password) {
            throw new Error('BOT_PASSWORD não definido no .env');
        }
        await frame.waitForSelector('#guestOrAccountContainer_accountButton', { timeout: 10000 });
        await this.retry(() => this.safeClick(frame, '#guestOrAccountContainer_accountButton', 250));
        await frame.waitForSelector('#loginwindow_username', { timeout: 8000, visible: true });
        await frame.evaluate((u, p) => {
            document.getElementById('loginwindow_username').value = u;
            document.getElementById('loginwindow_password').value = p;
        }, username, password);
        await frame.waitForSelector('#loginwindow_submitbutton', { timeout: 5000 });
        let loggedIn = false;
        const maxAttempts = 4;
        for (let i = 0; i < maxAttempts; i++) {
            await this.retry(() => this.safeClick(frame, '#loginwindow_submitbutton', 250));
            try {
                await frame.waitForSelector('#pretty_top_volume', { timeout: 5000, visible: true });
                await this.retry(() => this.safeClick(frame, '#pretty_top_volume', 250));
                loggedIn = true;
                break;
            }
            catch { }
        }
        if (!loggedIn) {
            throw new Error('Login falhou - verifique BOT_USERNAME e BOT_PASSWORD no .env');
        }
        try {
            await frame.waitForSelector('#pretty_top_volume_music', { timeout: 3000 });
            await this.retry(() => this.safeClick(frame, '#pretty_top_volume_music', 250));
        }
        catch {
            console.log('[RoomMaker] Botão de música não encontrado (ignorado, seguindo...)');
        }
        console.log('[RoomMaker] ✅ Login realizado');
    }
    async createGameRoom(frame, params) {
        console.log('[RoomMaker] 🏗️  Criando sala...');
        await frame.waitForSelector('#classic_mid_customgame', { timeout: 5000 });
        await this.retry(() => this.safeClick(frame, '#classic_mid_customgame', 250));
        const roomInfo = {
            roomName: params.name,
            roomPass: params.password,
            maxPlayers: params.maxPlayers,
            minLevel: params.minLevel,
            unlisted: params.unlisted,
        };
        let created = false;
        const maxAttempts = 4;
        for (let i = 0; i < maxAttempts; i++) {
            await frame.waitForSelector('#roomlistcreatebutton', { timeout: 5000 });
            await this.retry(() => this.safeClick(frame, '#roomlistcreatebutton', 250));
            await frame.waitForSelector('#roomlistcreatewindowgamename', { timeout: 5000 });
            await this.retry(() => this.safeClick(frame, '#roomlistcreatewindowgamename', 250));
            await frame.evaluate((info) => {
                document.getElementById('roomlistcreatewindowgamename').value = info.roomName;
                document.getElementById('roomlistcreatewindowpassword').value = info.roomPass;
                document.getElementById('roomlistcreatewindowmaxplayers').value = String(info.maxPlayers);
                document.getElementById('roomlistcreatewindowminlevel').value = String(info.minLevel);
                if (info.unlisted) {
                    document.getElementById('roomlistcreatewindowunlistedcheckbox').checked = true;
                }
            }, roomInfo);
            await frame.waitForSelector('#roomlistcreatecreatebutton', { timeout: 5000 });
            await this.retry(() => this.safeClick(frame, '#roomlistcreatecreatebutton', 250));
            try {
                await frame.waitForSelector('#newbonklobby_chatbox', { timeout: 10000 });
                await this.retry(() => this.safeClick(frame, '#newbonklobby_chatbox', 250));
                created = true;
                break;
            }
            catch {
                try {
                    await frame.waitForSelector('#sm_connectingWindowCancelButton', { timeout: 3000 });
                    await this.retry(() => this.safeClick(frame, '#sm_connectingWindowCancelButton', 250));
                }
                catch { }
            }
        }
        if (!created) {
            throw new Error('Room creation timeout.');
        }
        console.log('[RoomMaker] ✅ Sala criada no lobby');
    }
    async getRoomLink(frame) {
        console.log('[RoomMaker] 🔗 Obtendo link da sala...');
        await frame.waitForSelector('#newbonklobby_linkbutton', { timeout: 5000 });
        await this.retry(() => this.safeClick(frame, '#newbonklobby_linkbutton', 250));
        const roomLink = await this.retry(async () => {
            const link = await frame.evaluate(() => {
                const statusElements = document.querySelectorAll('.newbonklobby_chat_status');
                if (statusElements.length === 0)
                    return '';
                const lastStatus = statusElements[statusElements.length - 1];
                const text = lastStatus.innerText || lastStatus.textContent || '';
                const parts = text.split(' ');
                return parts[parts.length - 1];
            });
            if (!link)
                throw new Error('Link ainda não apareceu');
            return link;
        }, 10000, 250);
        return roomLink;
    }
    async configureRoom(page, frame, params) {
        console.log('[RoomMaker] ⚙️  Configurando sala...');
        const debugLog = process.env.BONK_DEBUG === '1' || process.env.BONK_DEBUG === 'true';
        const maxWaitMs = 6000;
        const pollIntervalMs = 400;
        let hasEngine = false;
        for (let waited = 0; waited < maxWaitMs; waited += pollIntervalMs) {
            hasEngine = await frame.evaluate(() => {
                const sgr = window.sgrAPI;
                return typeof sgr !== 'undefined' && !!sgr.toolFunctions?.networkEngine;
            });
            if (hasEngine)
                break;
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }
        if (!hasEngine) {
            console.warn('[RoomMaker] ⚠️ networkEngine não apareceu após ' + maxWaitMs + 'ms. Chat e lock podem não funcionar.');
        }
        else if (debugLog) {
            console.log('[RoomMaker:LOG] networkEngine disponível após espera');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
            const configResult = await frame.evaluate((mode, teams) => {
                const sgrAPI = window.sgrAPI;
                if (typeof sgrAPI === 'undefined')
                    return { ok: false, reason: 'no_sgrAPI', chatHooks: false };
                const hasEngine = !!sgrAPI.toolFunctions?.networkEngine;
                if (hasEngine) {
                    sgrAPI.setMode(mode);
                    sgrAPI.toolFunctions.networkEngine.sendNoHostSwap();
                    sgrAPI.toolFunctions.networkEngine.doTeamLock(true);
                    if (teams)
                        sgrAPI.setTeams(true);
                }
                window.messageBuffer = [];
                sgrAPI.onReceive = (message) => {
                    window.messageBuffer.push(message);
                    return true;
                };
                return {
                    ok: hasEngine,
                    reason: hasEngine ? null : 'no_networkEngine',
                    chatHooks: true,
                    hasPlayers: sgrAPI.players != null,
                };
            }, params.mode, params.teams ?? false);
            if (debugLog) {
                console.log('[RoomMaker:LOG] configureRoom execute:', configResult ?? '(undefined)');
            }
            if (configResult) {
                const r = configResult;
                if (!r.ok)
                    console.warn('[RoomMaker] ⚠️ networkEngine ausente (host/lock não aplicados). Chat configurado:', r.chatHooks);
                if (!r.chatHooks)
                    console.warn('[RoomMaker] ⚠️ Chat não configurado (sgrAPI ausente?)');
            }
        }
        catch (e) {
            console.warn('[RoomMaker] configureRoom execute falhou (sgrAPI/toolFunctions?):', e);
        }
        const roundsInput = await frame.$('#newbonklobby_roundsinput');
        if (roundsInput) {
            await roundsInput.click();
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.type(String(params.rounds), { delay: 60 });
            await page.keyboard.press('Tab');
            await roundsInput.dispose();
        }
        try {
            await frame.evaluate(() => {
                const sgr = window.sgrAPI;
                if (sgr?.toolFunctions?.networkEngine?.changeOwnTeam) {
                    sgr.toolFunctions.networkEngine.changeOwnTeam(0);
                }
            });
            console.log('[RoomMaker] 👁️ Bot em espectador');
        }
        catch (_) { }
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
            const favResult = await frame.evaluate(async () => {
                const sgr = window.sgrAPI;
                if (!sgr || typeof sgr.getFav !== 'function')
                    return { ok: false, reason: 'no_getFav' };
                const res = await sgr.getFav(0);
                if (res && res.maps && res.maps.length > 0) {
                    if (typeof sgr.loadMap === 'function')
                        sgr.loadMap(res.maps[0]);
                    return { ok: true, mapId: res.maps[0].id };
                }
                return { ok: false, reason: 'no_fav_maps' };
            });
            if (favResult && favResult.ok) {
                console.log('[RoomMaker] 🗺️ Mapa favorito carregado');
            }
            else if (params.maps && params.maps.length > 0) {
                await frame.evaluate((mapJson) => {
                    const sgrAPI = window.sgrAPI;
                    if (typeof sgrAPI !== 'undefined' && typeof sgrAPI.loadMap === 'function') {
                        sgrAPI.loadMap(JSON.parse(mapJson));
                    }
                }, params.maps[0]);
                console.log('[RoomMaker] 🗺️ Mapa do config carregado');
            }
        }
        catch (e) {
            if (debugLog)
                console.log('[RoomMaker:LOG] getFav/loadMap:', e.message);
        }
        console.log('[RoomMaker] ✅ Sala configurada');
    }
}
exports.RoomMaker = RoomMaker;
