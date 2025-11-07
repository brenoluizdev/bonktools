import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function leaveEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_LEAVE", (player: any) => {
    player = player.player;
    
    botInstance.chat(`👋 ${player.username} saiu da sala.`);
  });
}
