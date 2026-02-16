import { ratingSystem } from "../rating";
import { MESSAGES } from "../messages";

export default {
  name: "top",
  description: "Mostra o ranking dos melhores jogadores",
  execute(bot: any, name: string, args: string[]) {
    const count = args.length > 0 ? parseInt(args[0]) : 10;
    const limit = Math.min(Math.max(count, 1), 20); // Entre 1 e 20
    
    const topPlayers = ratingSystem.getTopPlayers(limit);
    
    if (topPlayers.length === 0) {
      bot.chat(MESSAGES.NO_PLAYERS_YET);
      return;
    }

    bot.chat(MESSAGES.TOP_PLAYERS(topPlayers.length));
    
    topPlayers.forEach((player, index) => {
      const position = index + 1;
      bot.chat(
        `${position}. ${player.username}: ${Math.round(player.rating)} pts ` +
        `(V:${player.wins} D:${player.losses} E:${player.ties})`
      );
    });
  },
};
