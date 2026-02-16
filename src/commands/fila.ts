import { roomState } from "../state/roomState";
import { MESSAGES } from "../messages";

export default {
  name: "fila",
  description: "Mostra a fila de jogadores",
  execute(bot: any) {
    const queue = roomState.getQueue();
    
    if (queue.length === 0) {
      bot.chat(MESSAGES.QUEUE_EMPTY);
      return;
    }

    const playerNames = queue.map(p => p.username);
    bot.chat(MESSAGES.QUEUE_LIST(playerNames));
  },
};
