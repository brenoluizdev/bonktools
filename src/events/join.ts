import bot from "../bot";

export default function joinEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_JOIN", (player: any) => {
    console.log(player)
    botInstance.chat(`👋 Bem-vindo, ${player.username}!`);
  });
}
