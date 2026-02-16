"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiscordLink = exports.getGeneralHelpMessage = exports.mbappa2x2Mode = void 0;
exports.getMode = getMode;
exports.getModeOrDefault = getModeOrDefault;
exports.getAllModeIds = getAllModeIds;
const mbappa2x2_1 = require("./mbappa2x2");
Object.defineProperty(exports, "mbappa2x2Mode", { enumerable: true, get: function () { return mbappa2x2_1.mbappa2x2Mode; } });
const mbappa1x1_1 = require("./mbappa1x1");
const classic1x1_1 = require("./classic1x1");
const grapple1x1_1 = require("./grapple1x1");
const deatharrow1x1_1 = require("./deatharrow1x1");
const blclassic_1 = require("./blclassic");
const volei1x1_1 = require("./volei1x1");
const barkball_1 = require("./barkball");
const blbasketball_1 = require("./blbasketball");
const blvolleyball_1 = require("./blvolleyball");
const corridacart_1 = require("./corridacart");
const modes = {
    mbappa1x1: mbappa1x1_1.mbappa1x1Mode,
    mbappa2x2: mbappa2x2_1.mbappa2x2Mode,
    classic1x1: classic1x1_1.classic1x1Mode,
    grapple1x1: grapple1x1_1.grapple1x1Mode,
    deatharrow1x1: deatharrow1x1_1.deatharrow1x1Mode,
    blclassic: blclassic_1.blclassicMode,
    volei1x1: volei1x1_1.volei1x1Mode,
    barkball: barkball_1.barkballMode,
    blbasketball: blbasketball_1.blbasketballMode,
    blvolleyball: blvolleyball_1.blvolleyballMode,
    corridacart: corridacart_1.corridacartMode,
};
function getMode(id) {
    const mode = modes[id];
    if (!mode)
        throw new Error(`Unknown mode: ${id}`);
    return mode;
}
function getModeOrDefault(id) {
    const modeId = (id ?? 'mbappa2x2').toLowerCase();
    if (modeId in modes)
        return modes[modeId];
    return mbappa2x2_1.mbappa2x2Mode;
}
function getAllModeIds() {
    return Object.keys(modes);
}
var commands_1 = require("./common/commands");
Object.defineProperty(exports, "getGeneralHelpMessage", { enumerable: true, get: function () { return commands_1.getGeneralHelpMessage; } });
Object.defineProperty(exports, "getDiscordLink", { enumerable: true, get: function () { return commands_1.getDiscordLink; } });
