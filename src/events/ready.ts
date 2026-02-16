import { existsSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import { spawn } from "child_process";
import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";
import { MESSAGES } from "../messages";
import { ROOM_CONFIG } from "../config/room";
import { roomState } from "../state/roomState";
import { ratingSystem } from "../rating";

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const INVESTIGATION_DIR = path.join(PROJECT_ROOT, "docs", "investigation");
const BROWSER_LOGGED_IN_FILE = path.join(INVESTIGATION_DIR, "browser_logged_in.txt");
const SCRIPT_OPEN_AS_BOT = path.join(PROJECT_ROOT, "scripts", "open-browser-as-bot.ts");

/** Modo navegador = bot: o navegador aberto É o bot (conta do bot, host da sala). O Node não entra na sala. */
const USE_BROWSER_AS_BOT = process.env.TEST_BROWSER_START === "1";

function spawnBrowserAsBot(): void {
  const env = {
    ...process.env,
    LOGIN_FIRST: "1",
    CREATE_ROOM: "1",
    BOT_USERNAME: process.env.BOT_USERNAME || "FUTHERO BOT",
    ROOM_NAME: ROOM_CONFIG.name,
    ROOM_PASSWORD: ROOM_CONFIG.password,
  };
  spawn(process.execPath, ["-r", "ts-node/register", SCRIPT_OPEN_AS_BOT], {
    env,
    stdio: "inherit",
    detached: true,
    cwd: PROJECT_ROOT,
    shell: false,
  }).unref();
  console.log("[BOT] Navegador = bot. Login + criação da sala automática (host).");
}

export default function readyEvent(botInstance: typeof bot) {
  botInstance.events.on("ready", async () => {
    // Inicializar sistemas
    roomState.init(botInstance);
    ratingSystem.init();
    
    if (USE_BROWSER_AS_BOT && existsSync(SCRIPT_OPEN_AS_BOT)) {
      console.log("✅ Modo bot no navegador: abrindo janela já logada como o bot.");
      mkdirSync(INVESTIGATION_DIR, { recursive: true });
      if (existsSync(BROWSER_LOGGED_IN_FILE)) unlinkSync(BROWSER_LOGGED_IN_FILE);
      spawnBrowserAsBot();
      return;
    }

    console.log(MESSAGES.BOT_READY);
    try {
      await botInstance.connect();
      console.log(MESSAGES.CONNECTED);
      
      const room = await botInstance.createRoom({
        roomname: ROOM_CONFIG.name,
        maxplayers: ROOM_CONFIG.maxPlayers,
        roompassword: ROOM_CONFIG.password,
        hidden: ROOM_CONFIG.hidden,
      });
      
      console.log(MESSAGES.ROOM_CREATED);

      // Bot sempre fica como espectador
      setTimeout(() => {
        botInstance.joinTeam(JoinTeam.SPEC);
      }, 2000);

      // Manter sala ativa
      setInterval(() => {
        const players = botInstance.getAllPlayers(true);
        if (players.length <= 1) {
          const botPlayer = players.find((p: any) => p.id === 0);
          if (botPlayer && botPlayer.team !== JoinTeam.SPEC) {
            botInstance.joinTeam(JoinTeam.SPEC);
          }
        }
      }, 1_200_000);
    } catch (err) {
      console.error(MESSAGES.CONNECTION_ERROR, err);
    }
  });
}
