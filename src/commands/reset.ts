import { roomState } from "../state/roomState";
import { RoomState } from "../state/types";
import { MESSAGES } from "../messages";

export default {
  name: "reset",
  description: "Vota para reiniciar a partida com o mesmo placar",
  execute(bot: any, name: string, args: string[], message: any) {
    const state = roomState.getState();
    
    // Só funciona em jogo
    if (state !== RoomState.IN_GAME && state !== RoomState.GAME_STARTING) {
      return;
    }

    const playerId = message.player.id;
    const currentMatch = roomState.getCurrentMatch();
    
    // Verifica se está na partida
    const isInMatch = 
      (currentMatch.picker && currentMatch.picker.id === playerId) ||
      (currentMatch.picked && currentMatch.picked.id === playerId);
    
    if (!isInMatch) {
      bot.chat(MESSAGES.NOT_IN_GAME);
      return;
    }

    const { current, total } = roomState.addResetVote(playerId);
    bot.chat(MESSAGES.VOTE_RESET(current, total));

    if (roomState.hasAllResetVotes()) {
      bot.chat(MESSAGES.RESETTING_MATCH);
      
      // Reset sem alterar ratings
      roomState.setState(RoomState.READY);
      
      // Limpar ready flags
      const queue = roomState.getQueue();
      queue.forEach(p => p.ready = false);
      
      setTimeout(() => {
        bot.chat(MESSAGES.USE_READY_COMMAND);
      }, 1000);
    }
  },
};
