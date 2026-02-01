/**
 * Serviço de pacotes Bonk: kick (out9) e mudar time de outro jogador (out26).
 * API Bonk: out9 = kick/ban (kickonly: true = só expulsar), out26 = change other team.
 */

import { JoinTeam } from "../types/joinTeam.types";
import { CLIENT_MESSAGE_TYPES_NUM } from "../types/constants.types";
import { isHost } from "./hostService";

type BotLike = {
  game?: { id?: number; host?: number };
  sendMessage: (eventId: number, data: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Expulsar jogador (kick only). API Bonk out9 com kickonly: true.
 * Só executa se o bot for host.
 */
export async function kickPlayer(
  bot: BotLike,
  playerId: number
): Promise<void> {
  if (!isHost(bot)) return;
  await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.KICK_BAN_PLAYER, {
    banshortid: playerId,
    kickonly: true,
  });
}

/**
 * Mover outro jogador de time. API Bonk out26.
 * targetTeam: JoinTeam.SPEC=0, JoinTeam.RED=2, JoinTeam.BLUE=3.
 * Só executa se o bot for host.
 */
export async function movePlayerToTeam(
  bot: BotLike,
  playerId: number,
  team: JoinTeam
): Promise<void> {
  if (!isHost(bot)) return;
  await bot.sendMessage(CLIENT_MESSAGE_TYPES_NUM.CHANGE_OTHER_TEAM, {
    targetID: playerId,
    targetTeam: team,
  });
}
