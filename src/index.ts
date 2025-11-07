import bot from "./bot";
import { readdirSync } from "fs";
import path from "path";


const eventsPath = path.join(__dirname, "events");
for (const file of readdirSync(eventsPath)) {
  import(path.join(eventsPath, file)).then((module) => {
    if (typeof module.default === "function") {
      module.default(bot);
      console.log(`🟢 Loaded event: ${file}`);
    }
  });
}

(async () => {
  try {
    await bot.init();
    console.log("✅ Bot initialized! Waiting for 'ready' event...");
  } catch (err) {
    console.error("❌ Failed to initialize bot:", err);
  }
})();