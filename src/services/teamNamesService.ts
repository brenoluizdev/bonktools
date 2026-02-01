/**
 * Atualização de nomes dos times no modo X1: quando há exatamente 1 jogador no vermelho e 1 no azul,
 * definir nomes dos times = usernames desses jogadores (se teamNamesManual for false).
 */

import { JoinTeam } from "../types/joinTeam.types";
import * as gameState from "../state/gameState";

export interface PlayerInfo {
  id: number;
  username?: string;
  team?: number;
}

/**
 * Atualiza nomes dos times se for 1v1 e não estiver em modo manual.
 * Chamar após TEAM_CHANGE, PLAYER_JOIN, PLAYER_LEAVE com a lista de jogadores (getAllPlayers(true)).
 */
export function updateTeamNamesIfX1(
  players: PlayerInfo[]
): void {
  if (gameState.isTeamNamesManual()) return;

  const red = players.filter((p) => p.team === JoinTeam.RED);
  const blue = players.filter((p) => p.team === JoinTeam.BLUE);

  if (red.length !== 1 || blue.length !== 1) return;

  const redName = red[0].username?.trim() || "Vermelho";
  const blueName = blue[0].username?.trim() || "Azul";

  gameState.updateTeamNamesAuto({ red: redName, blue: blueName });
}
