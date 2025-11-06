import bot from "../bot";
import { runCommand } from "../commands/handler";

export default function chatMessageEvent(botInstance: typeof bot) {
  botInstance.events.on("CHAT_MESSAGE", (message: any) => {
    console.log(`${message.player.username}: ${message.message}`);

    if (message.message.startsWith("!")) {
      const args = message.message.slice(1).split(" ");
      const commandName = args.shift()?.toLowerCase();
      if (commandName) runCommand(botInstance, commandName, args, message);
    }
  });
}
