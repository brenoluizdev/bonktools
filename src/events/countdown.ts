import bot from "../bot";

export default function countdownEvent(botInstance: typeof bot) {
    botInstance.events.on("COUNTDOWN", (countdown: unknown) => {
        console.log("[COUNTDOWN] payload:", JSON.stringify(countdown));
        if (countdown && typeof countdown === "object" && "countdown" in countdown) {
            console.log("[COUNTDOWN] número:", (countdown as { countdown?: number }).countdown);
        }
    });
}
