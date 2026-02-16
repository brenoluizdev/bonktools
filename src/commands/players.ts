import { roomState } from "../state/roomState";

export default {
  name: "players",
  description: "Mostra os jogadores online",
  execute(bot: any) {
    const players = bot.getAllPlayers(true);
    const names = players.map((p: any) => p.username);
    const count = players.length;
    
    bot.chat(`👥 Jogadores online (${count}): ${names.join(", ")}`);
    
    // Também mostrar fila
    const queue = roomState.getQueue();
    if (queue.length > 0) {
      bot.chat(`📋 Na fila (${queue.length}): ${queue.map(p => p.username).join(", ")}`);
    }
  },
};
