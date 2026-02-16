"use strict";
/**
 * Tipos para o estado da sala
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomState = void 0;
var RoomState;
(function (RoomState) {
    RoomState["IDLE"] = "idle";
    RoomState["PICK"] = "pick";
    RoomState["READY"] = "ready";
    RoomState["GAME_STARTING"] = "gameStarting";
    RoomState["IN_GAME"] = "inGame";
})(RoomState || (exports.RoomState = RoomState = {}));
