import { isHost } from "../services/hostService";
import * as gameState from "../state/gameState";
import type { TeamSide } from "../types/gameState.types";
import { MBAPPA_COMMANDS } from "../types/constants.types";

function parseScore(str: string): { red: number; blue: number } | null {
  const m = str.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const red = parseInt(m[1], 10);
  const blue = parseInt(m[2], 10);
  if (!Number.isFinite(red) || !Number.isFinite(blue) || red < 0 || blue < 0)
    return null;
  return { red, blue };
}

export default {
  name: MBAPPA_COMMANDS.GOALS,
  description: "Ajuste manual do placar (ex.: 3-2)",
  execute(bot: any, _name: string, args: string[]) {
    if (!isHost(bot)) {
      bot.chat("Apenas o host pode ajustar o placar.");
      return;
    }
    const raw = (args[0] || "").trim();
    const score = parseScore(raw);
    if (!score) {
      bot.chat("Uso: !goalsmbappa X-Y (ex.: 3-2).");
      return;
    }
    gameState.setScore(score);
    const leader: TeamSide | null =
      score.red > score.blue ? "red" : score.blue > score.red ? "blue" : null;
    gameState.setLeaderBefore(leader);
    bot.chat(`Placar ajustado: ${score.red} x ${score.blue}.`);
  },
};
