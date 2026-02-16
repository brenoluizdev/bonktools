"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATING_CONFIG = exports.TIMEOUTS = exports.ROOM_CONFIG = void 0;
exports.ROOM_CONFIG = {
    name: process.env.ROOM_NAME || "FUTHERO | SALA AUTOMATIZADA",
    password: process.env.ROOM_PASSWORD ?? "",
    maxPlayers: parseInt(process.env.ROOM_MAX_PLAYERS || "8"),
    hidden: process.env.ROOM_HIDDEN === "true",
    minLevel: parseInt(process.env.ROOM_MIN_LEVEL || "0"),
    unlisted: process.env.ROOM_UNLISTED === "true",
};
exports.TIMEOUTS = {
    IDLE_TIME: 30000, // 30 segundos sem jogadores suficientes
    PICK_TIME: 60000, // 60 segundos para escolher adversário
    READY_TIME: 60000, // 60 segundos para todos ficarem prontos
    GAME_TIME: 600000, // 10 minutos de jogo máximo
};
exports.RATING_CONFIG = {
    INITIAL_RATING: 1500,
    K_FACTOR: 32,
    MIN_RATING: 0,
    MAX_RATING: 3000,
};
