import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.PLAYERS,
  description: "Listar jogadores online",
  execute(bot: any, _name?: string, _args?: string[], _message?: any) {
    const players = bot.getAllPlayers(true);
    const names = players.map((p: any) => p.username);
    bot.chat(`👥 Jogadores (${players.length}): ${names.join(", ")}`);
  },
};
