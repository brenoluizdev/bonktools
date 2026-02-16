import { ratingSystem } from "../rating";
import { MESSAGES } from "../messages";

export default {
  name: "rating",
  description: "Mostra o rating de um jogador",
  execute(bot: any, name: string, args: string[], message: any) {
    // Se não passar nome, mostrar o próprio rating
    const targetUsername = args.length > 0 ? args.join(" ") : message.player.username;
    
    const stats = ratingSystem.getPlayerStats(targetUsername);
    
    if (!stats) {
      bot.chat(MESSAGES.RATING_NOT_FOUND(targetUsername));
      return;
    }

    bot.chat(MESSAGES.PLAYER_RATING(
      stats.username,
      stats.rating,
      stats.wins,
      stats.losses,
      stats.ties
    ));
  },
};
