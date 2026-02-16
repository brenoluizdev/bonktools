/**
 * Sistema de rating Elo simplificado
 */

import { RATING_CONFIG } from "../config/room";

export interface RatingResult {
  username: string;
  oldRating: number;
  newRating: number;
  change: number;
}

/**
 * Calcula a probabilidade esperada de vitória
 */
function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calcula o novo rating após uma partida
 */
export function calculateElo(
  winnerRating: number,
  loserRating: number,
  isTie: boolean = false
): { winnerNew: number; loserNew: number } {
  const expectedWinner = getExpectedScore(winnerRating, loserRating);
  const expectedLoser = getExpectedScore(loserRating, winnerRating);

  const actualWinner = isTie ? 0.5 : 1;
  const actualLoser = isTie ? 0.5 : 0;

  const winnerChange = RATING_CONFIG.K_FACTOR * (actualWinner - expectedWinner);
  const loserChange = RATING_CONFIG.K_FACTOR * (actualLoser - expectedLoser);

  const winnerNew = Math.max(
    RATING_CONFIG.MIN_RATING,
    Math.min(RATING_CONFIG.MAX_RATING, winnerRating + winnerChange)
  );

  const loserNew = Math.max(
    RATING_CONFIG.MIN_RATING,
    Math.min(RATING_CONFIG.MAX_RATING, loserRating + loserChange)
  );

  return { winnerNew, loserNew };
}

/**
 * Processa o resultado de uma partida e retorna os novos ratings
 */
export function processMatchResult(
  player1: string,
  player2: string,
  player1Rating: number,
  player2Rating: number,
  winner: "player1" | "player2" | "tie"
): { player1Result: RatingResult; player2Result: RatingResult } {
  const isTie = winner === "tie";
  const isPlayer1Winner = winner === "player1";

  const { winnerNew, loserNew } = calculateElo(
    isPlayer1Winner ? player1Rating : player2Rating,
    isPlayer1Winner ? player2Rating : player1Rating,
    isTie
  );

  const player1New = isPlayer1Winner || isTie ? (isTie ? player1Rating + (winnerNew - player1Rating) : winnerNew) : loserNew;
  const player2New = isPlayer1Winner ? loserNew : (isTie ? player2Rating + (loserNew - player2Rating) : winnerNew);

  // Para empates, calcular corretamente
  if (isTie) {
    const result = calculateElo(player1Rating, player2Rating, true);
    return {
      player1Result: {
        username: player1,
        oldRating: player1Rating,
        newRating: result.winnerNew,
        change: result.winnerNew - player1Rating,
      },
      player2Result: {
        username: player2,
        oldRating: player2Rating,
        newRating: result.loserNew,
        change: result.loserNew - player2Rating,
      },
    };
  }

  return {
    player1Result: {
      username: player1,
      oldRating: player1Rating,
      newRating: player1New,
      change: player1New - player1Rating,
    },
    player2Result: {
      username: player2,
      oldRating: player2Rating,
      newRating: player2New,
      change: player2New - player2Rating,
    },
  };
}
