import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";
import { MESSAGES } from "../messages";
import { roomState } from "../state/roomState";
import { Player } from "../state/types";
import { tryStartNextMatch } from "../state/transitions";

export default function joinEvent(botInstance: typeof bot) {
  botInstance.events.on("PLAYER_JOIN", (playerData: any) => {
    const player = playerData.player;

    // Mensagens de boas-vindas
    botInstance.chat(MESSAGES.WELCOME(player.username));
    botInstance.chat(MESSAGES.DEV_WARNING);
    
    setTimeout(() => {
      botInstance.chat(MESSAGES.DISCORD_LINK);
    }, 5000);

    // Bot sempre vai para spec se mais de 1 jogador
    const playersLength = botInstance.getAllPlayers(true);
    if (player.username === "FUTHERO BOT" || playersLength.length > 1) {
      botInstance.joinTeam(JoinTeam.SPEC);
    }

    // Adicionar à fila (exceto o bot)
    if (player.id !== 0 && player.username !== "FUTHERO BOT") {
      const newPlayer: Player = {
        id: player.id,
        username: player.username,
        team: player.team || 0,
        ready: false,
        joinedAt: Date.now(),
      };

      const added = roomState.addToQueue(newPlayer);
      if (added) {
        botInstance.chat(MESSAGES.ADDED_TO_QUEUE(player.username));
        
        // Tentar iniciar partida se houver jogadores suficientes
        setTimeout(() => {
          tryStartNextMatch(botInstance);
        }, 2000);
      }
    }
  });
}
