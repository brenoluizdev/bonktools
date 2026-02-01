/**
 * Fluxo de substituição no modo casual: 1 ou 2 espectadores substituem jogadores do time perdedor.
 * Timeout 15s; depois pergunta "Iniciar nova partida?" e escuta sim/não.
 */

import { JoinTeam } from "../types/joinTeam.types";
import { CLIENT_MESSAGE_TYPES_NUM } from "../types/constants.types";
import * as gameState from "../state/gameState";
import { kickPlayer, movePlayerToTeam } from "./packetService";

const DELAY_MS = 200;

type BotLike = {
  chat: (msg: string) => Promise<unknown>;
  sendMessage: (eventId: number, data: Record<string, unknown>) => Promise<unknown>;
  game?: { id?: number; host?: number };
};

function isHost(bot: BotLike): boolean {
  return (
    bot.game?.id !== undefined &&
    bot.game?.host !== undefined &&
    bot.game.id === bot.game.host
  );
}

export function runSubstitutionFlow(bot: BotLike): void {
  const sub = gameState.getSubstitutionState();
  const pending = sub.pendingSubstitution;
  if (!pending) return;

  const losingTeam = pending.losingTeam;
  const playersToReplace = sub.playersToReplace;
  const spectatorsAvailable = sub.spectatorsAvailable;

  if (spectatorsAvailable.length === 0) {
    gameState.resetSubstitutionState();
    bot.chat("Nenhum espectador disponível para substituição.");
    return;
  }

  const losingTeamId = losingTeam === "red" ? JoinTeam.RED : JoinTeam.BLUE;

  if (spectatorsAvailable.length === 1) {
    // 1 espectador: pedir número (1 ou 2) do jogador a substituir
    const list = playersToReplace
      .map((p, i) => `${i + 1}. ${p.username}`)
      .join(" | ");
    bot.chat(
      `🔄 Modo casual: 1 espectador. Digite o número do jogador a substituir (${list}) ou "cancelar". Tempo: 15s.`
    );
    gameState.setAwaitingSubstitutionAnswer(true);
    gameState.setSpectatorAwaitingAnswer(spectatorsAvailable[0].id);

    const handle = setTimeout(() => {
      if (!gameState.getSubstitutionState().awaitingSubstitutionAnswer) return;
      gameState.resetSubstitutionState();
      kickPlayer(bot as any, spectatorsAvailable[0].id);
      bot.chat("⏱️ Timeout. Espectador expulso por não responder.");
    }, gameState.SUBSTITUTION_TIMEOUT_MS);

    gameState.setSubstitutionTimeoutHandle(handle);
    return;
  }

  // 2 espectadores: substituir automaticamente 2 jogadores
  (async () => {
    const toReplace = playersToReplace.slice(0, 2);
    const specs = spectatorsAvailable.slice(0, 2);

    for (let i = 0; i < toReplace.length; i++) {
      await movePlayerToTeam(bot as any, toReplace[i].id, JoinTeam.SPEC);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    for (let i = 0; i < specs.length; i++) {
      await movePlayerToTeam(bot as any, specs[i].id, losingTeamId);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    gameState.setSubstitutionDone(true);
    gameState.setPendingSubstitution(null);
    gameState.setPlayersToReplace([]);
    gameState.setSpectatorsAvailable([]);
    askStartMatch(bot);
  })();
}

/** Processa resposta do espectador (1 ou 2 ou cancelar) no fluxo de 1 espectador. */
export function handleSubstitutionAnswer(
  bot: BotLike,
  spectatorId: number,
  message: string
): boolean {
  const sub = gameState.getSubstitutionState();
  if (!sub.awaitingSubstitutionAnswer || sub.spectatorAwaitingAnswer !== spectatorId) {
    return false;
  }

  const msg = message.trim().toLowerCase();
  if (msg === "cancelar") {
    gameState.resetSubstitutionState();
    bot.chat("Substituição cancelada.");
    return true;
  }

  const num = parseInt(msg, 10);
  if (num !== 1 && num !== 2) return false;

  const playersToReplace = sub.playersToReplace;
  const idx = num - 1;
  if (idx >= playersToReplace.length) return false;

  gameState.setAwaitingSubstitutionAnswer(false);
  gameState.setSpectatorAwaitingAnswer(null);
  if (sub.timeoutHandle) {
    clearTimeout(sub.timeoutHandle);
    gameState.setSubstitutionTimeoutHandle(null);
  }

  const pending = sub.pendingSubstitution;
  if (!pending) return true;

  const losingTeamId = pending.losingTeam === "red" ? JoinTeam.RED : JoinTeam.BLUE;
  const playerOut = playersToReplace[idx];

  (async () => {
    await movePlayerToTeam(bot as any, playerOut.id, JoinTeam.SPEC);
    await new Promise((r) => setTimeout(r, DELAY_MS));
    await movePlayerToTeam(bot as any, spectatorId, losingTeamId);
    gameState.setSubstitutionDone(true);
    gameState.setPendingSubstitution(null);
    gameState.setPlayersToReplace([]);
    gameState.setSpectatorsAvailable([]);
    askStartMatch(bot);
  })();

  return true;
}

function askStartMatch(bot: BotLike): void {
  gameState.setAwaitingStartMatchAnswer(true);
  bot.chat("Iniciar nova partida? Responda 'sim' ou 'não'.");
}

/** Processa resposta sim/não para iniciar nova partida. */
export function handleStartMatchAnswer(bot: BotLike, message: string): boolean {
  if (!gameState.getSubstitutionState().awaitingStartMatchAnswer) return false;

  const msg = message.trim().toLowerCase();
  if (msg !== "sim" && msg !== "não" && msg !== "nao") return false;

  gameState.setAwaitingStartMatchAnswer(false);

  if (msg === "sim" && isHost(bot)) {
    bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.TRIGGER_START, {}).catch(() => {
      bot.chat("Não foi possível iniciar a partida (API start).");
    });
    bot.chat("Partida iniciada!");
  } else if (msg === "não" || msg === "nao") {
    bot.chat("Partida não iniciada. Host pode iniciar manualmente.");
  }

  return true;
}
