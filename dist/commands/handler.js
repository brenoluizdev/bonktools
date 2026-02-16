"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const commands = new Map();
const commandsPath = path_1.default.join(__dirname);
function loadCommand(filePath) {
    Promise.resolve(`${filePath}`).then(s => __importStar(require(s))).then((module) => {
        if (module.default?.name)
            commands.set(module.default.name, module.default);
    });
}
const isCommandFile = (f) => (f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts") && f !== "handler.ts" && f !== "handler.js";
// Comandos na raiz de commands/
for (const file of (0, fs_1.readdirSync)(commandsPath)) {
    if (!isCommandFile(file))
        continue;
    loadCommand(path_1.default.join(commandsPath, file));
}
// Comandos Mbappa em commands/mbappa/
const mbappaPath = path_1.default.join(commandsPath, "mbappa");
if ((0, fs_1.existsSync)(mbappaPath)) {
    for (const file of (0, fs_1.readdirSync)(mbappaPath)) {
        if (!file.endsWith(".ts") && !file.endsWith(".js"))
            continue;
        loadCommand(path_1.default.join(mbappaPath, file));
    }
}
function runCommand(bot, name, args, message) {
    const command = commands.get(name);
    if (!command)
        return;
    command.execute(bot, name, args, message);
}
