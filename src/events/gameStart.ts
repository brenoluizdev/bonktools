import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function gameStart(botInstance: typeof bot) {
    botInstance.events.on("GAME_START", () => {
        console.log('GAME_START event received!');
    });
}