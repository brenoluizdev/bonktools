import bot from "../bot";
import { MESSAGES } from "../messages";
import { handleMatchEnd } from "../state/transitions";
import { roomState } from "../state/roomState";
import { RoomState } from "../state/types";

export default function gameEnd(botInstance: typeof bot) {
  botInstance.events.on("GAME_END", () => {
    botInstance.chat(MESSAGES.GAME_ENDED);
    
    const state = roomState.getState();
    
    // Só processar se estiver em jogo
    if (state !== RoomState.IN_GAME && state !== RoomState.GAME_STARTING) {
      return;
    }

    // Tentar determinar vencedor
    // Nota: isso depende da API do bonktools expor o resultado
    // Por enquanto, considerar empate se não conseguir determinar
    
    try {
      // TODO: Adaptar para pegar placar real do bonktools
      // const players = botInstance.getAllPlayers(true);
      // const scores = botInstance.getScores(); // se existir
      
      // Por enquanto, processar como empate
      handleMatchEnd(botInstance, "tie");
    } catch (error) {
      console.error("[GameEnd] Erro ao processar fim de jogo:", error);
      // Em caso de erro, resetar e tentar próxima
      roomState.reset();
      const { tryStartNextMatch } = require("../state/transitions");
      setTimeout(() => {
        tryStartNextMatch(botInstance);
      }, 2000);
    }
  });
}
