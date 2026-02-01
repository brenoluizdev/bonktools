import { isHost } from "../services/hostService";
import * as gameState from "../state/gameState";
import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.META,
  description: "Definir meta de gols (host only)",
  execute(bot: any, _name: string, args: string[]) {
    if (!isHost(bot)) {
      bot.chat("Apenas o host pode definir a meta de gols.");
      return;
    }
    const raw = args[0];
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) {
      bot.chat("Uso: !metambappa X (X = número positivo).");
      return;
    }
    gameState.setGoalMeta(n);
    bot.chat(`Meta de gols definida: ${n}.`);
  },
};
