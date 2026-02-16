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
const bot_1 = __importDefault(require("./bot"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const browserManager_1 = require("./browser/browserManager");
const eventsPath = path_1.default.join(__dirname, "events");
for (const file of (0, fs_1.readdirSync)(eventsPath)) {
    Promise.resolve(`${path_1.default.join(eventsPath, file)}`).then(s => __importStar(require(s))).then((module) => {
        if (typeof module.default === "function") {
            module.default(bot_1.default);
            console.log(`🟢 Loaded event: ${file}`);
        }
    });
}
// Graceful shutdown - fechar navegador ao encerrar bot
process.on("SIGINT", async () => {
    console.log("\n[Bot] Recebido SIGINT (Ctrl+C). Encerrando...");
    try {
        await browserManager_1.browserManager.close();
    }
    catch (error) {
        console.error("[Bot] Erro ao fechar navegador:", error);
    }
    process.exit(0);
});
process.on("SIGTERM", async () => {
    console.log("\n[Bot] Recebido SIGTERM. Encerrando...");
    try {
        await browserManager_1.browserManager.close();
    }
    catch (error) {
        console.error("[Bot] Erro ao fechar navegador:", error);
    }
    process.exit(0);
});
(async () => {
    try {
        await bot_1.default.init();
        console.log("✅ Bot initialized! Waiting for 'ready' event...");
    }
    catch (err) {
        console.error("❌ Failed to initialize bot:", err);
    }
})();
