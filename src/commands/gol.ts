import { registerGoal, checkGoalMeta } from "../services/goalService";
import type { TeamSide } from "../types/gameState.types";
import { MBAPPA_COMMANDS } from "../types/constants.types";

const TEAM_ALIASES: Record<string, TeamSide> = {
  red: "red",
  blue: "blue",
  vermelho: "red",
  azul: "blue",
};

export default {
  name: MBAPPA_COMMANDS.GOL,
  description: "Registrar gol manual (!gol red/blue ou vermelho/azul)",
  execute(bot: any, _name: string, args: string[]) {
    const raw = (args[0] || "").trim().toLowerCase();
    const team = TEAM_ALIASES[raw];
    if (!team) {
      bot.chat("Uso: !gol red | !gol blue (ou vermelho | azul).");
      return;
    }
    registerGoal(bot, team);
    checkGoalMeta(bot);
  },
};
