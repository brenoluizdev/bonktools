import { setFootballMode } from "../functions/setFootballMode";
import { SERVER_MESSAGE_TYPES } from "../types/constants.types";
import { JoinTeam } from "../types/joinTeam.types";

export default {
  name: "teste",
  description: "teste",
  async execute(bot: any) {
    await bot.ready(true);

    await new Promise(resolve => setTimeout(resolve, 500));
    
    await bot.setFootballMode();
    // await bot.setTeamSettings({ teamCount: 2, locked: false });
    await bot.joinTeam(JoinTeam.SPEC);
  },
};
