"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = countdownEvent;
function countdownEvent(botInstance) {
    botInstance.events.on("COUNTDOWN", (countdown) => {
        console.log("[COUNTDOWN] payload:", JSON.stringify(countdown));
        if (countdown && typeof countdown === "object" && "countdown" in countdown) {
            console.log("[COUNTDOWN] número:", countdown.countdown);
        }
    });
}
