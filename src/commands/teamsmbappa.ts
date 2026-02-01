import { isHost } from "../services/hostService";
import * as gameState from "../state/gameState";
import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.TEAMS,
  description: "Definir nomes dos times (host only)",
  execute(bot: any, _name: string, args: string[]) {
    if (!isHost(bot)) {
      bot.chat("Apenas o host pode definir os nomes dos times.");
      return;
    }
    const redName = (args[0] || "Vermelho").trim();
    const blueName = (args[1] || "Azul").trim();
    gameState.setTeamNames({ red: redName, blue: blueName });
    bot.chat(`Times: ${redName} x ${blueName}.`);
  },
};
