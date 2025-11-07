import { createBot, LOG_LEVELS } from "bonkbot";
require("dotenv").config();

const bot = createBot({
  account: {
    username: "FUTHERO BOT",
    password: process.env.BOT_PASSWORD,
    guest: false,
  },
  PROTOCOL_VERSION: 49,
  server: "b2brazil1",
  logLevel: LOG_LEVELS.WARN,
});

export default bot;
