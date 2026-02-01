/**
 * Serviço de gols: registrar gol manual, virada, meta e fim de partida por meta.
 * Integra com gameState e, em modo casual, dispara fluxo de substituição.
 */

import type { TeamSide } from "../types/gameState.types";
import { JoinTeam } from "../types/joinTeam.types";
import * as gameState from "../state/gameState";
import { runSubstitutionFlow } from "./substitutionService";

type BotLike = {
  chat: (msg: string) => Promise<unknown>;
  getAllPlayers: (includeSelf?: boolean) => Array<{ id: number; username: string; team?: number }>;
};

/**
 * Registra gol para um time: atualiza placar, verifica virada, envia mensagens e checa meta.
 */
export function registerGoal(bot: BotLike, team: TeamSide): void {
  const leaderBefore = gameState.getLeaderBefore();
  const score = gameState.getScore();

  gameState.incrementGoal(team);
  const newScore = gameState.getScore();
  const currentLeader = gameState.getCurrentLeader();

  // Virada: líder mudou e não era empate antes
  if (
    currentLeader &&
    leaderBefore !== null &&
    leaderBefore !== currentLeader &&
    score.red !== score.blue
  ) {
    const teamLabel =
      currentLeader === "red"
        ? gameState.getTeamNames().red
        : gameState.getTeamNames().blue;
    bot.chat(`🔄 Time ${teamLabel} virou o jogo!`);
  }

  gameState.setLeaderBefore(currentLeader);

  const teamNames = gameState.getTeamNames();
  const teamLabel = team === "red" ? teamNames.red : teamNames.blue;
  bot.chat(`⚽ Gol do time ${teamLabel}! Placar: ${newScore.red} x ${newScore.blue}`);

  checkGoalMeta(bot);
}

/**
 * Se alguma equipe atingir a meta de gols, encerra a partida e, em modo casual, inicia substituição.
 */
export function checkGoalMeta(bot: BotLike): void {
  const goalMeta = gameState.getGoalMeta();
  if (goalMeta == null) return;

  const score = gameState.getScore();
  if (score.red >= goalMeta || score.blue >= goalMeta) {
    endMatchByMeta(bot);
  }
}

/**
 * Encerra partida por meta: mensagem, zera placar e leaderBefore; em modo casual inicia fluxo de substituição.
 */
export function endMatchByMeta(bot: BotLike): void {
  const goalMeta = gameState.getGoalMeta();
  const score = gameState.getScore();
  const winner: TeamSide = score.red >= (goalMeta ?? 0) ? "red" : "blue";
  const teamNames = gameState.getTeamNames();
  const winnerName = winner === "red" ? teamNames.red : teamNames.blue;

  bot.chat(
    `🏁 PARTIDA ENCERRADA! Meta de ${goalMeta} gols atingida. Vitória do time ${winnerName}!`
  );

  gameState.setScore({ red: 0, blue: 0 });
  gameState.setLeaderBefore(null);

  if (gameState.isModeCasualActive()) {
    const losingTeam: TeamSide = winner === "red" ? "blue" : "red";
    gameState.setPendingSubstitution(losingTeam);

    const players = bot.getAllPlayers(true);
    const losingTeamId = losingTeam === "red" ? JoinTeam.RED : JoinTeam.BLUE;
    const playersToReplace = players
      .filter((p) => p.team === losingTeamId)
      .map((p) => ({ id: p.id, username: p.username || "?" }));
    const spectatorsAvailable = players
      .filter((p) => p.team === JoinTeam.SPEC)
      .map((p) => ({ id: p.id, username: p.username || "?" }));

    gameState.setPlayersToReplace(playersToReplace);
    gameState.setSpectatorsAvailable(spectatorsAvailable);
    runSubstitutionFlow(bot as any);
  }
}
