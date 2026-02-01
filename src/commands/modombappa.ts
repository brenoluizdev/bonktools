import { isHost } from "../services/hostService";
import * as gameState from "../state/gameState";
import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.MODO,
  description: "Ativar/desativar modo casual (host only)",
  execute(bot: any, _name: string, args: string[]) {
    if (!isHost(bot)) {
      bot.chat("Apenas o host pode alterar o modo.");
      return;
    }
    const sub = (args[0] || "").trim().toLowerCase();
    if (sub === "casual") {
      gameState.setMode("casual");
      gameState.setModeCasualActive(true);
      gameState.setGoalMeta(5);
      bot.chat("Modo casual ativado. Meta de gols: 5.");
    } else if (sub === "off") {
      gameState.setMode(null);
      gameState.setModeCasualActive(false);
      gameState.resetSubstitutionState();
      bot.chat("Modo casual desativado.");
    } else {
      bot.chat("Uso: !modombappa casual | !modombappa off");
    }
  },
};
