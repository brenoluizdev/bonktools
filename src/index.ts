import bot from "./bot";
import { readdirSync } from "fs";
import path from "path";
import { browserManager } from "./browser/browserManager";

const eventsPath = path.join(__dirname, "events");
for (const file of readdirSync(eventsPath)) {
  import(path.join(eventsPath, file)).then((module) => {
    if (typeof module.default === "function") {
      module.default(bot);
      console.log(`🟢 Loaded event: ${file}`);
    }
  });
}

// Graceful shutdown - fechar navegador ao encerrar bot
process.on("SIGINT", async () => {
  console.log("\n[Bot] Recebido SIGINT (Ctrl+C). Encerrando...");
  try {
    await browserManager.close();
  } catch (error) {
    console.error("[Bot] Erro ao fechar navegador:", error);
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Bot] Recebido SIGTERM. Encerrando...");
  try {
    await browserManager.close();
  } catch (error) {
    console.error("[Bot] Erro ao fechar navegador:", error);
  }
  process.exit(0);
});

(async () => {
  try {
    await bot.init();
    console.log("✅ Bot initialized! Waiting for 'ready' event...");
  } catch (err) {
    console.error("❌ Failed to initialize bot:", err);
  }
})();
