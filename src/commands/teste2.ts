import { SERVER_MESSAGE_TYPES } from "../types/constants.types";
import { JoinTeam } from "../types/joinTeam.types";

export default {
  name: "teste2",
  description: "teste2",
  async execute(bot: any) {
    await bot.ready(true);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    await bot.startGame();
  },
};
