import bot from "./bot";
import { readdirSync } from "fs";
import path from "path";
import { JoinTeam } from "./types/joinTeam.types";

bot.init().then(() => {
  console.log("✅ Bot initialized!")
}).catch((err) => console.error("Failed to initialize bot:", err));

const eventsPath = path.join(__dirname, "events");
for (const file of readdirSync(eventsPath)) {
  import(path.join(eventsPath, file)).then((module) => {
    if (typeof module.default === "function") {
      module.default(bot);
      console.log(`🟢 Loaded event: ${file}`);
    }
  });
};