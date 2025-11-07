import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";
import { Logger } from "../utils/logger";

export default function joinEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_JOIN", (player: any) => {
    Logger.debug(JSON.stringify(player));

    player = player.player;
    botInstance.chat(`👋 Bem-vindo à Futhero, ${player.username}!`);
    botInstance.chat(`⚠️ Lembre-se: Essa sala está em desenvolvimento e pode apresentar bugs.`);
    setTimeout(() => {
      botInstance.chat(`ℹ️ Faça parte da nossa comunidade no Discord: https://discord.gg/qRJ4UCMfja`);
    }, 5000);

    const playersLength = botInstance.getAllPlayers(true);

    if (player.username === "FUTHERO BOT" || playersLength.length > 1) {
      bot.joinTeam(JoinTeam.SPEC);
      
      return;
    };
  });
}
