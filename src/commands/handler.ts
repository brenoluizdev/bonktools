import { readdirSync } from "fs";
import path from "path";

const commands = new Map<string, any>();

const commandsPath = path.join(__dirname);
for (const file of readdirSync(commandsPath)) {
  if (file === "handler.ts") continue;
  import(path.join(commandsPath, file)).then((module) => {
    if (module.default?.name) commands.set(module.default.name, module.default);
  });
}

export function runCommand(bot: any, name: string, args: string[], message: any) {
  const command = commands.get(name);
  if (!command) return;
  command.execute(bot, name, args, message);
}
