import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function countdownEvent(botInstance: typeof bot) {
    botInstance.events.on("COUNTDOWN", (countdown) => {
        console.log(countdown)
    });
}
