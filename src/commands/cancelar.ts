import { roomState } from "../state/roomState";
import { RoomState } from "../state/types";
import { MESSAGES } from "../messages";

export default {
  name: "cancelar",
  description: "Vota para cancelar a partida",
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

    const { current, total } = roomState.addCancelVote(playerId);
    bot.chat(MESSAGES.VOTE_CANCEL(current, total));

    if (roomState.hasAllCancelVotes()) {
      bot.chat(MESSAGES.CANCELLING_MATCH);
      
      // Resetar sala
      roomState.reset();
      
      // Tentar iniciar próxima partida
      const { tryStartNextMatch } = require("../state/transitions");
      setTimeout(() => {
        tryStartNextMatch(bot);
      }, 2000);
    }
  },
};
