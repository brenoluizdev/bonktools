import { roomState } from "../state/roomState";
import { RoomState } from "../state/types";
import { MESSAGES } from "../messages";
import { JoinTeam } from "../types/joinTeam.types";
import { changeOtherTeam, startGameAsHost } from "../utils/botExtensions";

export default {
  name: "p",
  description: "Escolhe um adversário (quando for sua vez)",
  execute(bot: any, name: string, args: string[], message: any) {
    const state = roomState.getState();
    
    // Só funciona no estado PICK
    if (state !== RoomState.PICK) {
      bot.chat(MESSAGES.COMMAND_NOT_FOUND);
      return;
    }

    const playerId = message.player.id;
    const currentMatch = roomState.getCurrentMatch();
    
    // Verifica se é a vez deste jogador
    if (!currentMatch.picker || currentMatch.picker.id !== playerId) {
      if (currentMatch.picker) {
        bot.chat(MESSAGES.NOT_YOUR_TURN(currentMatch.picker.username));
      }
      return;
    }

    // Pega o nome do adversário (resto dos args)
    const opponentQuery = args.join(" ").trim();
    
    if (!opponentQuery) {
      bot.chat(MESSAGES.USE_PICK_COMMAND);
      return;
    }

    // Busca jogadores por nome (fuzzy)
    const matches = roomState.findPlayersByName(opponentQuery);
    
    // Remove o picker dos matches
    const validMatches = matches.filter(p => p.id !== playerId);
    
    if (validMatches.length === 0) {
      bot.chat(MESSAGES.NO_MATCH_FOUND);
      return;
    }
    
    if (validMatches.length > 1) {
      bot.chat(MESSAGES.MULTIPLE_MATCHES);
      const names = validMatches.map(p => p.username).join(", ");
      bot.chat(`Jogadores encontrados: ${names}`);
      return;
    }

    // Match único!
    const picked = validMatches[0];
    roomState.setPicked(picked);
    
    bot.chat(MESSAGES.PLAYER_PICKED(currentMatch.picker.username, picked.username));
    bot.chat(MESSAGES.MATCH_STARTING(currentMatch.picker.username, picked.username));
    
    // Colocar jogadores em times usando CHANGE_OTHER_TEAM
    (async () => {
      try {
        // Picker vai para time 2 (RED), picked vai para time 3 (BLUE)
        await changeOtherTeam(bot, currentMatch.picker!.id, JoinTeam.RED);
        await new Promise(r => setTimeout(r, 100));
        await changeOtherTeam(bot, picked.id, JoinTeam.BLUE);
        await new Promise(r => setTimeout(r, 200));
        
        console.log(`[Pick] Times configurados: ${currentMatch.picker!.username}=RED, ${picked.username}=BLUE`);
        
        // Avançar para o estado READY
        roomState.setState(RoomState.READY);
        roomState.clearTimer("pick");
        
        bot.chat(MESSAGES.USE_READY_COMMAND);
        
        // Timer para ready
        const { TIMEOUTS } = require("../config/room");
        roomState.startTimer("ready", () => {
          bot.chat(MESSAGES.READY_TIMEOUT);
          roomState.reset();
          
          // Tentar iniciar próxima partida
          const { tryStartNextMatch } = require("../state/transitions");
          tryStartNextMatch(bot);
        }, TIMEOUTS.READY_TIME);
      } catch (error) {
        console.error("[Pick] Erro ao configurar times:", error);
        bot.chat("❌ Erro ao configurar times. Entrem manualmente nos times (vermelho/azul).");
      }
    })();
  },
};
