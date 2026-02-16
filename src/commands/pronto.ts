import { roomState } from "../state/roomState";
import { RoomState } from "../state/types";
import { MESSAGES } from "../messages";
import { startGameAsHost } from "../utils/botExtensions";

export default {
  name: "r",
  description: "Marca como pronto para jogar",
  execute(bot: any, name: string, args: string[], message: any) {
    const state = roomState.getState();

    if (state !== RoomState.READY) {
      return;
    }

    const playerId = message.player.id;
    const currentMatch = roomState.getCurrentMatch();

    const isInMatch =
      (currentMatch.picker && currentMatch.picker.id === playerId) ||
      (currentMatch.picked && currentMatch.picked.id === playerId);

    if (!isInMatch) {
      bot.chat(MESSAGES.NOT_IN_GAME);
      return;
    }

    const player = roomState.getPlayerById(playerId);
    if (player) {
      player.ready = true;
    }

    let readyCount = 0;
    let totalCount = 0;

    if (currentMatch.picker) {
      totalCount++;
      const pickerInQueue = roomState.getPlayerById(currentMatch.picker.id);
      if (pickerInQueue?.ready) readyCount++;
    }

    if (currentMatch.picked) {
      totalCount++;
      const pickedInQueue = roomState.getPlayerById(currentMatch.picked.id);
      if (pickedInQueue?.ready) readyCount++;
    }

    bot.chat(MESSAGES.PLAYER_READY(player?.username || "Jogador", readyCount, totalCount));

    if (readyCount >= totalCount && totalCount > 0) {
      bot.chat(MESSAGES.ALL_READY);
      roomState.clearTimer("ready");
      roomState.setState(RoomState.GAME_STARTING);

      (async () => {
        try {
          const started = await startGameAsHost(bot);
          if (started) {
            roomState.setState(RoomState.IN_GAME);
            console.log("[Game] Partida iniciada (ready + SEND_START_COUNTDOWN)");
          } else {
            roomState.setState(RoomState.IN_GAME);
            console.warn("[Game] sendMessage não disponível; estado atualizado apenas.");
          }
        } catch (error) {
          console.error("[Game] Erro ao iniciar partida:", error);
          bot.chat("❌ Não foi possível iniciar a partida. O host pode iniciar manualmente.");
        }
      })();
    }
  },
};
