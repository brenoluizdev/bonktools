import bot from "../bot";

export default function roomShareLinkEvent(botInstance: typeof bot) {
  botInstance.events.on("ROOM_SHARE_LINK", (data) => {
    console.log(`🟢 Room link available!\nURL: ${data.url}`);
  });
}
