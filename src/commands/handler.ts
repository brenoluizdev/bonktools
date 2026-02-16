import { readdirSync, existsSync } from "fs";
import path from "path";

const commands = new Map<string, { name: string; execute: (bot: any, name?: string, args?: string[], message?: any) => void | Promise<void> }>();

const commandsPath = path.join(__dirname);

function loadCommand(filePath: string) {
  import(filePath).then((module) => {
    if (module.default?.name) commands.set(module.default.name, module.default);
  });
}

const isCommandFile = (f: string) =>
  (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts") && f !== "handler.ts" && f !== "handler.js";

// Comandos na raiz de commands/
for (const file of readdirSync(commandsPath)) {
  if (!isCommandFile(file)) continue;
  loadCommand(path.join(commandsPath, file));
}

// Comandos Mbappa em commands/mbappa/
const mbappaPath = path.join(commandsPath, "mbappa");
if (existsSync(mbappaPath)) {
  for (const file of readdirSync(mbappaPath)) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
    loadCommand(path.join(mbappaPath, file));
  }
}

export function runCommand(bot: any, name: string, args: string[], message: any) {
  const command = commands.get(name);
  if (!command) return;
  command.execute(bot, name, args, message);
}
