import bot from "../bot";

export default function packetEvent(botInstance: typeof bot) {
  botInstance.events.on("PACKET", (packet: any) => {
    botInstance.autoHandlePacket(packet);
    
    if (packet.type === "TIMESYNC" || packet.type === "PLAYER_PINGS") {
			return;
		}

		console.log("Received packet:", packet);
  });
}
