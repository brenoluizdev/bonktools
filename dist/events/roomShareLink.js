"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = roomShareLinkEvent;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const browserManager_1 = require("../browser/browserManager");
// Caminhos a partir da raiz do projeto
const PROJECT_ROOT = path_1.default.join(__dirname, "..", "..");
const INVESTIGATION_DIR = path_1.default.join(PROJECT_ROOT, "docs", "investigation");
const ROOM_URL_FILE = path_1.default.join(INVESTIGATION_DIR, "room_url.txt");
function ensureDir(dir) {
    try {
        (0, fs_1.mkdirSync)(dir, { recursive: true });
    }
    catch {
        // ignore
    }
}
function fullUrlForRoom(url) {
    return url.startsWith("http") ? url : `https://bonk.io/${url}`;
}
function roomShareLinkEvent(botInstance) {
    botInstance.events.on("ROOM_SHARE_LINK", async (data) => {
        const url = (data?.url ?? "").trim();
        const fullUrl = fullUrlForRoom(url);
        console.log(`🟢 Room link available!\nURL: ${fullUrl}`);
        if (url) {
            try {
                ensureDir(INVESTIGATION_DIR);
                (0, fs_1.writeFileSync)(ROOM_URL_FILE, url, "utf-8");
                console.log(`🟢 Room URL gravada em ${ROOM_URL_FILE}`);
            }
            catch (e) {
                console.error("Erro ao gravar room_url.txt:", e);
            }
            console.log("\n--- URL da sala ---");
            console.log(fullUrl);
            console.log("---\n");
            // Iniciar navegador automaticamente para manter a sala "viva"
            const autoStartBrowser = process.env.AUTO_START_BROWSER !== "false";
            if (autoStartBrowser) {
                try {
                    console.log("[Browser] Aguardando 2 segundos para o bot estabilizar na sala...");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    console.log("[Browser] Iniciando navegador automático para manter sala ativa...");
                    await browserManager_1.browserManager.launch(fullUrl, {
                        headless: process.env.BROWSER_HEADLESS === "true",
                        executablePath: process.env.CHROME_PATH,
                    });
                    console.log("[Browser] ✅ Navegador iniciado com sucesso!");
                }
                catch (error) {
                    console.error("[Browser] ❌ Erro ao iniciar navegador:", error);
                    console.log("[Browser] O bot continuará funcionando, mas algumas ações (como game start) podem não funcionar.");
                    console.log(`[Browser] Abra manualmente a sala no navegador: ${fullUrl}`);
                }
            }
            else {
                console.log("[Browser] AUTO_START_BROWSER=false - Abra manualmente:");
                console.log(fullUrl);
            }
        }
    });
}
