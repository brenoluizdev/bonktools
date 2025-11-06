import { createBot, LOG_LEVELS } from "bonkbot";

const bot = createBot({
  account: {
    username: "FUTHERO BOT",
    password: "$futheroroomsbot025",
    guest: false,
  },
  PROTOCOL_VERSION: 49,
  server: "b2brazil1",
  logLevel: LOG_LEVELS.DEBUG,
});

export default bot;
