import bot from "../bot";

export default function packetEvent(botInstance: typeof bot) {
  botInstance.events.on("PACKET", async (packet: any) => {
    if (packet.type === "TIMESYNC" || packet.type === "PLAYER_PINGS") {
      return;
    }
    
    botInstance.autoHandlePacket(packet);
  });
}
