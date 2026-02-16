"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = readyEvent;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const joinTeam_types_1 = require("../types/joinTeam.types");
const messages_1 = require("../messages");
const room_1 = require("../config/room");
const roomState_1 = require("../state/roomState");
const rating_1 = require("../rating");
const PROJECT_ROOT = path_1.default.join(__dirname, "..", "..");
const INVESTIGATION_DIR = path_1.default.join(PROJECT_ROOT, "docs", "investigation");
const BROWSER_LOGGED_IN_FILE = path_1.default.join(INVESTIGATION_DIR, "browser_logged_in.txt");
const SCRIPT_OPEN_AS_BOT = path_1.default.join(PROJECT_ROOT, "scripts", "open-browser-as-bot.ts");
/** Modo navegador = Nao permitir que node entre na sala junto com navegador do bot */
const USE_BROWSER_AS_BOT = process.env.TEST_BROWSER_START === "1";
function spawnBrowserAsBot() {
    const env = {
        ...process.env,
        LOGIN_FIRST: "1",
        CREATE_ROOM: "1",
        BOT_USERNAME: process.env.BOT_USERNAME || "FUTHERO BOT",
        ROOM_NAME: room_1.ROOM_CONFIG.name,
        ROOM_PASSWORD: room_1.ROOM_CONFIG.password,
    };
    (0, child_process_1.spawn)(process.execPath, ["-r", "ts-node/register", SCRIPT_OPEN_AS_BOT], {
        env,
        stdio: "inherit",
        detached: true,
        cwd: PROJECT_ROOT,
        shell: false,
    }).unref();
    console.log("[BOT] Navegador = bot. Login + criação da sala automática (host).");
}
function readyEvent(botInstance) {
    botInstance.events.on("ready", async () => {
        // Inicializar sistemas
        roomState_1.roomState.init(botInstance);
        rating_1.ratingSystem.init();
        if (USE_BROWSER_AS_BOT && (0, fs_1.existsSync)(SCRIPT_OPEN_AS_BOT)) {
            console.log("✅ Modo bot no navegador: abrindo janela já logada como o bot.");
            (0, fs_1.mkdirSync)(INVESTIGATION_DIR, { recursive: true });
            if ((0, fs_1.existsSync)(BROWSER_LOGGED_IN_FILE))
                (0, fs_1.unlinkSync)(BROWSER_LOGGED_IN_FILE);
            spawnBrowserAsBot();
            return;
        }
        console.log(messages_1.MESSAGES.BOT_READY);
        try {
            await botInstance.connect();
            console.log(messages_1.MESSAGES.CONNECTED);
            const room = await botInstance.createRoom({
                roomname: room_1.ROOM_CONFIG.name,
                maxplayers: room_1.ROOM_CONFIG.maxPlayers,
                roompassword: room_1.ROOM_CONFIG.password,
                hidden: room_1.ROOM_CONFIG.hidden,
            });
            console.log(messages_1.MESSAGES.ROOM_CREATED);
            // Bot sempre fica como espectador
            setTimeout(() => {
                botInstance.joinTeam(joinTeam_types_1.JoinTeam.SPEC);
            }, 2000);
            // Manter sala ativa
            setInterval(() => {
                const players = botInstance.getAllPlayers(true);
                if (players.length <= 1) {
                    const botPlayer = players.find((p) => p.id === 0);
                    if (botPlayer && botPlayer.team !== joinTeam_types_1.JoinTeam.SPEC) {
                        botInstance.joinTeam(joinTeam_types_1.JoinTeam.SPEC);
                    }
                }
            }, 1200000);
        }
        catch (err) {
            console.error(messages_1.MESSAGES.CONNECTION_ERROR, err);
        }
    });
}
