/**
 * API principal do sistema de rating
 */

import { ratingStorage, PlayerStats, MatchRecord } from "./storage";
import { calculateElo, processMatchResult, RatingResult } from "./elo";

export interface MatchResult {
  player1: RatingResult;
  player2: RatingResult;
}

class RatingSystem {
  /**
   * Inicializa o sistema de rating
   */
  init(dbPath?: string) {
    ratingStorage.init(dbPath);
  }

  /**
   * Processa o resultado de uma partida
   */
  processMatch(
    player1Username: string,
    player2Username: string,
    winner: "player1" | "player2" | "tie"
  ): MatchResult {
    // Obter ou criar jogadores
    const player1 = ratingStorage.getOrCreatePlayer(player1Username);
    const player2 = ratingStorage.getOrCreatePlayer(player2Username);

    // Calcular novos ratings
    const result = processMatchResult(
      player1Username,
      player2Username,
      player1.rating,
      player2.rating,
      winner
    );

    // Determinar resultado de cada jogador
    const player1Result = 
      winner === "player1" ? "win" : winner === "tie" ? "tie" : "loss";
    const player2Result = 
      winner === "player2" ? "win" : winner === "tie" ? "tie" : "loss";

    // Atualizar no banco
    ratingStorage.updatePlayerRating(
      player1Username,
      result.player1Result.newRating,
      player1Result
    );
    
    ratingStorage.updatePlayerRating(
      player2Username,
      result.player2Result.newRating,
      player2Result
    );

    // Registrar partida
    ratingStorage.recordMatch({
      player1: player1Username,
      player2: player2Username,
      winner,
      player1OldRating: result.player1Result.oldRating,
      player2OldRating: result.player2Result.oldRating,
      player1NewRating: result.player1Result.newRating,
      player2NewRating: result.player2Result.newRating,
      timestamp: Date.now(),
    });

    console.log(`[Rating] Partida processada: ${player1Username} vs ${player2Username}`);
    console.log(`  ${player1Username}: ${Math.round(result.player1Result.oldRating)} → ${Math.round(result.player1Result.newRating)} (${result.player1Result.change >= 0 ? '+' : ''}${Math.round(result.player1Result.change)})`);
    console.log(`  ${player2Username}: ${Math.round(result.player2Result.oldRating)} → ${Math.round(result.player2Result.newRating)} (${result.player2Result.change >= 0 ? '+' : ''}${Math.round(result.player2Result.change)})`);

    return {
      player1: result.player1Result,
      player2: result.player2Result,
    };
  }

  /**
   * Obtém as estatísticas de um jogador
   */
  getPlayerStats(username: string): PlayerStats | null {
    try {
      const player = ratingStorage.getOrCreatePlayer(username);
      return player.matchesPlayed > 0 ? player : null;
    } catch (error) {
      console.error(`[Rating] Erro ao obter stats de ${username}:`, error);
      return null;
    }
  }

  /**
   * Obtém o ranking dos melhores jogadores
   */
  getTopPlayers(limit: number = 10): PlayerStats[] {
    return ratingStorage.getTopPlayers(limit);
  }

  /**
   * Obtém o histórico de partidas de um jogador
   */
  getPlayerMatches(username: string, limit: number = 10): MatchRecord[] {
    return ratingStorage.getPlayerMatches(username, limit);
  }

  /**
   * Fecha o sistema de rating
   */
  close() {
    ratingStorage.close();
  }
}

// Singleton
export const ratingSystem = new RatingSystem();
export { PlayerStats, MatchRecord, RatingResult };
