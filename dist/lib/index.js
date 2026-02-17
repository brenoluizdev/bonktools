"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_LEVELS = exports.createBot = exports.RoomMaker = void 0;
exports.startRoom = startRoom;
const roomMaker_1 = require("../browser/roomMaker");
var roomMaker_2 = require("../browser/roomMaker");
Object.defineProperty(exports, "RoomMaker", { enumerable: true, get: function () { return roomMaker_2.RoomMaker; } });
var bonktools_1 = require("bonktools");
Object.defineProperty(exports, "createBot", { enumerable: true, get: function () { return bonktools_1.createBot; } });
Object.defineProperty(exports, "LOG_LEVELS", { enumerable: true, get: function () { return bonktools_1.LOG_LEVELS; } });
async function startRoom(params) {
    const maker = new roomMaker_1.RoomMaker();
    await maker.init();
    return maker.createRoom(params);
}
