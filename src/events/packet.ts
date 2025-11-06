import bot from "../bot";

export default function packetEvent(botInstance: typeof bot) {
  botInstance.events.on("PACKET", (packet: any) => {
    botInstance.autoHandlePacket(packet);
  });
}
