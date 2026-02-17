import bot from "./bot";
import { readdirSync, statSync } from "fs";
import path from "path";
import { browserManager } from "./browser/browserManager";

const eventsPath = path.join(__dirname, "events");

function listEventFiles(dir: string): string[] {
  const items = readdirSync(dir);
  const files: string[] = [];
  for (const item of items) {
    const full = path.join(dir, item);
    const st = statSync(full);
    if (st.isDirectory()) {
      files.push(...listEventFiles(full));
    } else if (st.isFile() && (full.endsWith(".js") || full.endsWith(".cjs") || full.endsWith(".mjs"))) {
      files.push(full);
    }
  }
  return files;
}

for (const file of listEventFiles(eventsPath)) {
  import(file).then((module) => {
    if (typeof module.default === "function") {
      module.default(bot);
      console.log(`🟢 Loaded event: ${path.relative(eventsPath, file)}`);
    }
  });
}

// Graceful shutdown - close browser when bot is terminated
process.on("SIGINT", async () => {
  console.log("\n[Bot] Received SIGINT (Ctrl+C). Shutting down...");
  try {
    await browserManager.close();
  } catch (error) {
    console.error("[Bot] Error while closing browser:", error);
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Bot] Received SIGTERM. Shutting down...");
  try {
    await browserManager.close();
  } catch (error) {
    console.error("[Bot] Error while closing browser:", error);
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
