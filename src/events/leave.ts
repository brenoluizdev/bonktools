import bot from "../bot";
import { MESSAGES } from "../messages";
import { handlePlayerLeave } from "../state/transitions";

export default function leaveEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_LEAVE", (playerData: any) => {
    const player = playerData.player;
    
    botInstance.chat(MESSAGES.PLAYER_LEFT(player.username));
    
    // Processar saída do jogador
    if (player.id !== 0) {
      handlePlayerLeave(botInstance, player.id);
    }
  });
}
