import * as gameState from "../state/gameState";
import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.PLACAR,
  description: "Mostrar placar atual (e meta de gols se houver)",
  execute(bot: any, _name?: string, _args?: string[], _message?: any) {
    const score = gameState.getScore();
    const names = gameState.getTeamNames();
    const meta = gameState.getGoalMeta();
    let msg = `📊 Placar: ${names.red} ${score.red} x ${score.blue} ${names.blue}`;
    if (meta != null) msg += ` | Meta: ${meta} gols`;
    bot.chat(msg);
  },
};
