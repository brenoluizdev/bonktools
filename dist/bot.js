"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bonktools_1 = require("bonktools");
require("dotenv").config();
const bot = (0, bonktools_1.createBot)({
    account: {
        username: "FUTHERO BOT",
        password: process.env.BOT_PASSWORD,
        guest: false,
    },
    PROTOCOL_VERSION: 49,
    server: "b2brazil1",
    logLevel: bonktools_1.LOG_LEVELS.WARN,
});
exports.default = bot;
