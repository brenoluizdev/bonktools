import bot from "../bot";

export default function leaveEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_LEAVE", (player: any) => {
    botInstance.chat(`👋 ${player.username} saiu da sala.`);
  });
}
