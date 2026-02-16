"use strict";
/**
 * Sistema de rating Elo simplificado
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateElo = calculateElo;
exports.processMatchResult = processMatchResult;
const room_1 = require("../config/room");
/**
 * Calcula a probabilidade esperada de vitória
 */
function getExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
/**
 * Calcula o novo rating após uma partida
 */
function calculateElo(winnerRating, loserRating, isTie = false) {
    const expectedWinner = getExpectedScore(winnerRating, loserRating);
    const expectedLoser = getExpectedScore(loserRating, winnerRating);
    const actualWinner = isTie ? 0.5 : 1;
    const actualLoser = isTie ? 0.5 : 0;
    const winnerChange = room_1.RATING_CONFIG.K_FACTOR * (actualWinner - expectedWinner);
    const loserChange = room_1.RATING_CONFIG.K_FACTOR * (actualLoser - expectedLoser);
    const winnerNew = Math.max(room_1.RATING_CONFIG.MIN_RATING, Math.min(room_1.RATING_CONFIG.MAX_RATING, winnerRating + winnerChange));
    const loserNew = Math.max(room_1.RATING_CONFIG.MIN_RATING, Math.min(room_1.RATING_CONFIG.MAX_RATING, loserRating + loserChange));
    return { winnerNew, loserNew };
}
/**
 * Processa o resultado de uma partida e retorna os novos ratings
 */
function processMatchResult(player1, player2, player1Rating, player2Rating, winner) {
    const isTie = winner === "tie";
    const isPlayer1Winner = winner === "player1";
    const { winnerNew, loserNew } = calculateElo(isPlayer1Winner ? player1Rating : player2Rating, isPlayer1Winner ? player2Rating : player1Rating, isTie);
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
