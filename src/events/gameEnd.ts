import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function gameEnd(botInstance: typeof bot) {
    botInstance.events.on("GAME_END", () => {
        botInstance.chat(`🎉 O jogo acabou!`);
    });
}
