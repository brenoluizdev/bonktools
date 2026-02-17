/**
 * Bot extensions for features not exposed directly by bonktools.
 */

import { CLIENT_MESSAGE_TYPES_NUM } from "../types/constants.types";

/**
 * Changes another player's team (requires host).
 * @param bot - Bot instance
 * @param playerId - Player ID
 * @param team - Target team (0=spec, 1=FFA, 2=red, 3=blue)
 */
export async function changeOtherTeam(
  bot: any,
  playerId: number,
  team: number
): Promise<boolean> {
  try {
    if (typeof bot.sendMessage !== "function") {
      console.error("[BotExt] sendMessage is not available");
      return false;
    }

    await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.CHANGE_OTHER_TEAM, {
      id: playerId,
      targetTeam: team,
    });

    console.log(`[BotExt] Player ${playerId} team changed to ${team}`);
    return true;
  } catch (error) {
    console.error(`[BotExt] Error while changing team:`, error);
    return false;
  }
}

/**
 * Starts the game as host (sends ready + countdown).
 * @param bot - Bot instance
 */
export async function startGameAsHost(bot: any): Promise<boolean> {
  try {
    // 1. Host marks itself as ready
    if (typeof bot.ready === "function") {
      await bot.ready(true);
      await new Promise((r) => setTimeout(r, 150));
    }

    // 2. Send 1-second countdown
    if (typeof bot.sendMessage === "function") {
      await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.SEND_START_COUNTDOWN, 1);
      console.log("[BotExt] startGame: ready + countdown(1) sent");
      return true;
    }

    return false;
  } catch (e) {
    console.error("[BotExt] startGameAsHost error:", e);
    throw e;
  }
}

/**
 * Resets ready status for all players.
 * @param bot - Bot instance
 */
export async function allReadyReset(bot: any): Promise<boolean> {
  try {
    if (typeof bot.sendMessage !== "function") {
      return false;
    }

    await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.ALL_READY_RESET, {});
    console.log("[BotExt] allReadyReset sent");
    return true;
  } catch (error) {
    console.error("[BotExt] Error while resetting ready:", error);
    return false;
  }
}
