import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import bot from "../bot";
import { browserManager } from "../browser/browserManager";

// Caminhos a partir da raiz do projeto (src/events/ -> ../../)
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const INVESTIGATION_DIR = path.join(PROJECT_ROOT, "docs", "investigation");
const ROOM_URL_FILE = path.join(INVESTIGATION_DIR, "room_url.txt");

function ensureDir(dir: string) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // ignore
  }
}

function fullUrlForRoom(url: string): string {
  return url.startsWith("http") ? url : `https://bonk.io/${url}`;
}

export default function roomShareLinkEvent(botInstance: typeof bot) {
  botInstance.events.on("ROOM_SHARE_LINK", async (data: { url?: string }) => {
    const url = (data?.url ?? "").trim();
    const fullUrl = fullUrlForRoom(url);
    console.log(`🟢 Room link available!\nURL: ${fullUrl}`);
    
    if (url) {
      try {
        ensureDir(INVESTIGATION_DIR);
        writeFileSync(ROOM_URL_FILE, url, "utf-8");
        console.log(`🟢 Room URL gravada em ${ROOM_URL_FILE}`);
      } catch (e) {
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
          await browserManager.launch(fullUrl, {
            headless: process.env.BROWSER_HEADLESS === "true",
            executablePath: process.env.CHROME_PATH,
          });
          console.log("[Browser] ✅ Navegador iniciado com sucesso!");
        } catch (error) {
          console.error("[Browser] ❌ Erro ao iniciar navegador:", error);
          console.log("[Browser] O bot continuará funcionando, mas algumas ações (como game start) podem não funcionar.");
          console.log(`[Browser] Abra manualmente a sala no navegador: ${fullUrl}`);
        }
      } else {
        console.log("[Browser] AUTO_START_BROWSER=false - Abra manualmente:");
        console.log(fullUrl);
      }
    }
  });
}
