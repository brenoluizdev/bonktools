import { MBAPPA_COMMANDS } from "../types/constants.types";

export default {
  name: MBAPPA_COMMANDS.XRAY,
  description: "X-ray (indisponível neste cliente)",
  execute(bot: any) {
    bot.chat("⚠️ X-ray indisponível neste cliente (Node/bonkbot).");
  },
};
