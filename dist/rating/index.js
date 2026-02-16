"use strict";
/**
 * API principal do sistema de rating
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratingSystem = void 0;
const storage_1 = require("./storage");
const elo_1 = require("./elo");
class RatingSystem {
    /**
     * Inicializa o sistema de rating
     */
    init(dbPath) {
        storage_1.ratingStorage.init(dbPath);
    }
    /**
     * Processa o resultado de uma partida
     */
    processMatch(player1Username, player2Username, winner) {
        // Obter ou criar jogadores
        const player1 = storage_1.ratingStorage.getOrCreatePlayer(player1Username);
        const player2 = storage_1.ratingStorage.getOrCreatePlayer(player2Username);
        // Calcular novos ratings
        const result = (0, elo_1.processMatchResult)(player1Username, player2Username, player1.rating, player2.rating, winner);
        // Determinar resultado de cada jogador
        const player1Result = winner === "player1" ? "win" : winner === "tie" ? "tie" : "loss";
        const player2Result = winner === "player2" ? "win" : winner === "tie" ? "tie" : "loss";
        // Atualizar no banco
        storage_1.ratingStorage.updatePlayerRating(player1Username, result.player1Result.newRating, player1Result);
        storage_1.ratingStorage.updatePlayerRating(player2Username, result.player2Result.newRating, player2Result);
        // Registrar partida
        storage_1.ratingStorage.recordMatch({
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
    getPlayerStats(username) {
        try {
            const player = storage_1.ratingStorage.getOrCreatePlayer(username);
            return player.matchesPlayed > 0 ? player : null;
        }
        catch (error) {
            console.error(`[Rating] Erro ao obter stats de ${username}:`, error);
            return null;
        }
    }
    /**
     * Obtém o ranking dos melhores jogadores
     */
    getTopPlayers(limit = 10) {
        return storage_1.ratingStorage.getTopPlayers(limit);
    }
    /**
     * Obtém o histórico de partidas de um jogador
     */
    getPlayerMatches(username, limit = 10) {
        return storage_1.ratingStorage.getPlayerMatches(username, limit);
    }
    /**
     * Fecha o sistema de rating
     */
    close() {
        storage_1.ratingStorage.close();
    }
}
// Singleton
exports.ratingSystem = new RatingSystem();
