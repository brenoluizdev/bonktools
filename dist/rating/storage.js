"use strict";
/**
 * Armazenamento de dados de rating com SQLite
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratingStorage = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const room_1 = require("../config/room");
const path_1 = __importDefault(require("path"));
class RatingStorage {
    constructor() {
        this.db = null;
    }
    /**
     * Inicializa o banco de dados
     */
    init(dbPath) {
        const finalPath = dbPath || path_1.default.join(process.cwd(), "data", "ratings.db");
        // Criar diretório se não existir
        const fs = require("fs");
        const dir = path_1.default.dirname(finalPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(finalPath);
        this.createTables();
        console.log(`[Rating] Banco de dados inicializado: ${finalPath}`);
    }
    /**
     * Cria as tabelas necessárias
     */
    createTables() {
        if (!this.db)
            throw new Error("Database not initialized");
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        username TEXT PRIMARY KEY,
        rating REAL NOT NULL DEFAULT ${room_1.RATING_CONFIG.INITIAL_RATING},
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        ties INTEGER NOT NULL DEFAULT 0,
        matches_played INTEGER NOT NULL DEFAULT 0,
        last_played INTEGER
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1 TEXT NOT NULL,
        player2 TEXT NOT NULL,
        winner TEXT NOT NULL,
        player1_old_rating REAL NOT NULL,
        player2_old_rating REAL NOT NULL,
        player1_new_rating REAL NOT NULL,
        player2_new_rating REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_players_rating ON players(rating DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp DESC);
    `);
    }
    /**
     * Obtém ou cria um jogador
     */
    getOrCreatePlayer(username) {
        if (!this.db)
            throw new Error("Database not initialized");
        const stmt = this.db.prepare("SELECT * FROM players WHERE username = ?");
        let player = stmt.get(username);
        if (!player) {
            const insertStmt = this.db.prepare(`
        INSERT INTO players (username, rating, wins, losses, ties, matches_played)
        VALUES (?, ?, 0, 0, 0, 0)
      `);
            insertStmt.run(username, room_1.RATING_CONFIG.INITIAL_RATING);
            player = stmt.get(username);
        }
        return {
            username: player.username,
            rating: player.rating,
            wins: player.wins,
            losses: player.losses,
            ties: player.ties,
            matchesPlayed: player.matches_played,
            lastPlayed: player.last_played,
        };
    }
    /**
     * Atualiza o rating de um jogador
     */
    updatePlayerRating(username, newRating, result) {
        if (!this.db)
            throw new Error("Database not initialized");
        const updates = {
            rating: newRating,
            matches_played: 1,
            last_played: Date.now(),
        };
        if (result === "win")
            updates.wins = 1;
        else if (result === "loss")
            updates.losses = 1;
        else if (result === "tie")
            updates.ties = 1;
        const stmt = this.db.prepare(`
      UPDATE players
      SET rating = ?,
          wins = wins + ?,
          losses = losses + ?,
          ties = ties + ?,
          matches_played = matches_played + 1,
          last_played = ?
      WHERE username = ?
    `);
        stmt.run(newRating, result === "win" ? 1 : 0, result === "loss" ? 1 : 0, result === "tie" ? 1 : 0, Date.now(), username);
    }
    /**
     * Registra uma partida
     */
    recordMatch(match) {
        if (!this.db)
            throw new Error("Database not initialized");
        const stmt = this.db.prepare(`
      INSERT INTO matches (
        player1, player2, winner,
        player1_old_rating, player2_old_rating,
        player1_new_rating, player2_new_rating,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(match.player1, match.player2, match.winner, match.player1OldRating, match.player2OldRating, match.player1NewRating, match.player2NewRating, match.timestamp);
    }
    /**
     * Obtém o ranking dos jogadores
     */
    getTopPlayers(limit = 10) {
        if (!this.db)
            throw new Error("Database not initialized");
        const stmt = this.db.prepare(`
      SELECT * FROM players
      WHERE matches_played > 0
      ORDER BY rating DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map(row => ({
            username: row.username,
            rating: row.rating,
            wins: row.wins,
            losses: row.losses,
            ties: row.ties,
            matchesPlayed: row.matches_played,
            lastPlayed: row.last_played,
        }));
    }
    /**
     * Obtém o histórico de partidas de um jogador
     */
    getPlayerMatches(username, limit = 10) {
        if (!this.db)
            throw new Error("Database not initialized");
        const stmt = this.db.prepare(`
      SELECT * FROM matches
      WHERE player1 = ? OR player2 = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(username, username, limit);
        return rows.map(row => ({
            id: row.id,
            player1: row.player1,
            player2: row.player2,
            winner: row.winner,
            player1OldRating: row.player1_old_rating,
            player2OldRating: row.player2_old_rating,
            player1NewRating: row.player1_new_rating,
            player2NewRating: row.player2_new_rating,
            timestamp: row.timestamp,
        }));
    }
    /**
     * Fecha a conexão com o banco de dados
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log("[Rating] Banco de dados fechado");
        }
    }
}
// Singleton
exports.ratingStorage = new RatingStorage();
