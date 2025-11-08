import { SERVER_MESSAGE_TYPES } from "../types/constants.types";
import { JoinTeam } from "../types/joinTeam.types";

export default {
  name: "teste3",
  description: "teste3",
  async execute(bot: any, name: string, args: string[], message: any) {
    const player = message.player;

    bot.giveHost(player.id);
  },
};
