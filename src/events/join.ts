import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function joinEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_JOIN", (player: any) => {
    player = player.player;
    botInstance.chat(`👋 Bem-vindo à Futhero, ${player.username}!`);
    botInstance.chat(`ℹ️ Faça parte da nossa comunidade no Discord: https://discord.gg/qRJ4UCMfja`);

    if (player.username === "FUTHERO BOT") {
      bot.joinTeam(JoinTeam.SPEC);
      
      return;
    };
  });
}
