import bot from "../bot";
import { runCommand } from "../commands/handler";
import fetch from "node-fetch";

export default function chatMessageEvent(botInstance: typeof bot) {
  botInstance.events.on("CHAT_MESSAGE", async (message: any) => {
    console.log(`${message.player.username}: ${message.message}`);

    if (message.message.startsWith("!")) {
      const args = message.message.slice(1).split(" ");
      const commandName = args.shift()?.toLowerCase();
      if (commandName) runCommand(botInstance, commandName, args, message);
    }

    const webhookUrl = "https://ptb.discord.com/api/webhooks/1436166854128173157/96mioei_V-UlraNL_irizDcfCyBL6ruDUvRPZF59bWgE_eBVXdgyRcIYnwQrD9bP4E01";

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `${message.player.username || "FUTHERO BOT"}: ${message.message}`,
        })
      });
    } catch (error) {
      console.error('Error sending message to webhook:', error);
    }
  });
}
