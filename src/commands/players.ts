export default {
  name: "players",
  description: "Mostra os jogadores online",
  execute(bot: any) {
    const players = bot.getAllPlayers(true);
    const names = players.map((p: any) => p.username);
    bot.chat(`👥 Players online (${players.length}): ${names.join(", ")}`);
  },
};
