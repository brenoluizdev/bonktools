import bot from "../bot";

export default function readyEvent(botInstance: typeof bot) {
  botInstance.events.on("ready", async () => {
    console.log("✅ Bot is ready!");

    await botInstance.connect();

    // Cria a sala
    const room = await botInstance.createRoom({
      roomname: "🔥 FUTHERO | X2 | FUTSAL 🔥",
      maxplayers: 8,
      roompassword: "0102030405",
      hidden: false,
    });

    console.log(room);
    console.log(`🟢 Room created!\nURL: ${botInstance.getShareLink()}`);
  });
}
