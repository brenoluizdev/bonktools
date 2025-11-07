import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function gameModeChange(botInstance: typeof bot) {
  botInstance.events.on("GAMEMODE_CHANGE", (mode: any, engine: any) => {
    console.log(`🟢 Game mode changed to ${mode} (${engine})`);
  });
}
