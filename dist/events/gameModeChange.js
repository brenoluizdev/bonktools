"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = gameModeChange;
function gameModeChange(botInstance) {
    botInstance.events.on("GAMEMODE_CHANGE", (mode, engine) => {
        console.log(`🟢 Game mode changed to ${mode} (${engine})`);
    });
}
