"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = teamChange;
const logger_1 = require("../utils/logger");
function teamChange(botInstance) {
    botInstance.events.on("TEAM_CHANGE", (player, team) => {
        logger_1.Logger.debug(`${player.username} changed team to ${team}`);
    });
}
