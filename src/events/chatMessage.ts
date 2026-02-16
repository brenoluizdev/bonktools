import bot from "../bot";
import { runCommand } from "../commands/handler";
import { MESSAGES } from "../messages";
import fetch from "node-fetch";

export default function chatMessageEvent(botInstance: typeof bot) {
  botInstance.events.on("CHAT_MESSAGE", async (message: any) => {
    console.log(`${message.player.username}: ${message.message}`);

    if (message.message.startsWith("!")) {
      const args = message.message.slice(1).split(" ");
      const commandName = args.shift()?.toLowerCase();
      
      if (commandName) {
        // Aliases de comandos
        const aliases: Record<string, string> = {
          "queue": "fila",
          "q": "fila",
          "help": "ajuda",
          "h": "ajuda",
          "escolher": "p",
          "pick": "p",
          "pronto": "r",
          "ready": "r",
          "re": "reset",
          "c": "cancelar",
          "cancel": "cancelar",
          "rank": "rating",
        };
        
        const finalCommand = aliases[commandName] || commandName;
        runCommand(botInstance, finalCommand, args, message);
      }
    }

    // Webhook Discord (opcional)
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
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
    }
  });
}
