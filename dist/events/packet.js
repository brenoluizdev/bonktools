"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = packetEvent;
function packetEvent(botInstance) {
    botInstance.events.on("PACKET", async (packet) => {
        if (packet.type === "TIMESYNC" || packet.type === "PLAYER_PINGS") {
            return;
        }
        botInstance.autoHandlePacket(packet);
    });
}
