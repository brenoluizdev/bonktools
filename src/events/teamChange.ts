import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";
import { Logger } from "../utils/logger";

export default function teamChange(botInstance: typeof bot) {
  botInstance.events.on("TEAM_CHANGE", (player: any, team: any) => {
    Logger.debug(`${player.username} changed team to ${team}`);
  });
}
