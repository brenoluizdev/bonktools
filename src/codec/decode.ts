import type { IncomingPacket, UnknownPacket } from './packets.js';
import { INCOMING_PACKET_IDS, IncomingPacketSchema } from './packets.js';
import type { Logger } from 'pino';

// Pitfall 6: o socket.io-client@2 emite eventos com IDs numéricos e já desmonta
// o envelope "42[...]" em [N, ...args]. Este decode recebe o array, NÃO a string raw.
// Uso típico no transport: socket.on(N, (...args) => decode([N, ...args])).

/**
 * Decodifica um packet incoming do bonk.io (array [id, ...args]) em um objeto tipado.
 *
 * Defensivo (boundary server→codec): qualquer packet não mapeado retorna
 * `{ type: 'UNKNOWN', raw }` em vez de lançar (T-1-T1 mitigate).
 *
 * @deprecated Prefer decodeWithZod() for Phase 2+ packets — full zod validation.
 * This function is kept for Phase 1 backwards compatibility (D-02).
 */
export function decode(packet: [number, ...unknown[]]): IncomingPacket {
  const [type, ...args] = packet;

  switch (type) {
    case INCOMING_PACKET_IDS.TIMESYNC: {
      const payload = args[0] as { result: number; id: number };
      return { type: 'TIMESYNC', time: payload.result, id: payload.id };
    }
    case INCOMING_PACKET_IDS.STATUS_MESSAGE:
      return { type: 'STATUS_MESSAGE', status: args[0] as string };
    case INCOMING_PACKET_IDS.SHARE_LINK:
      return {
        type: 'SHARE_LINK',
        roomId: args[0] as number,
        bypass: args[1] as string,
      };
    case INCOMING_PACKET_IDS.ROOM_CREATED:
      return {
        type: 'ROOM_CREATED',
        sockId: args[0] as string,
        myId: args[1] as number,
      };
    default:
      return { type: 'UNKNOWN', raw: packet };
  }
}

/**
 * Mapeia um array de packet [id, ...args] para um objeto raw com campo `type` string.
 * Helper interno para decodeWithZod — prepara o objeto antes da validação zod.
 * Retorna null se o ID não for mapeado (packet desconhecido).
 *
 * D-11: função defensiva — nunca lança. Objetos opacos (avatar, mapData) são
 * passados como-estão sem coerção; zod valida a estrutura externa.
 */
function buildRawObject(type: number, args: unknown[]): Record<string, unknown> | null {
  switch (type) {
    // Fase 1 packets
    case INCOMING_PACKET_IDS.ROOM_CREATED:
      return { type: 'ROOM_CREATED', sockId: args[0], myId: args[1] };

    case INCOMING_PACKET_IDS.STATUS_MESSAGE:
      return { type: 'STATUS_MESSAGE', status: args[0] };

    case INCOMING_PACKET_IDS.TIMESYNC: {
      const payload = args[0] as { result: number; id: number } | null;
      return { type: 'TIMESYNC', time: payload?.result, id: payload?.id };
    }

    case INCOMING_PACKET_IDS.SHARE_LINK:
      return { type: 'SHARE_LINK', roomId: args[0], bypass: args[1] };

    // Fase 2 packets — roster
    case INCOMING_PACKET_IDS.PLAYER_PINGS:
      return { type: 'PLAYER_PINGS', pings: args[0], pingId: args[1] };

    case INCOMING_PACKET_IDS.JOIN_ROOM:
      return {
        type: 'ROOM_JOIN',
        myId: args[0],
        hostId: args[1],
        players: args[2],
        timestamp: args[3],
        teamsLocked: args[4],
        roomId: args[5],
        roomBypass: args[6],
      };

    case INCOMING_PACKET_IDS.PLAYER_JOIN:
      return {
        type: 'PLAYER_JOIN',
        id: args[0],
        peerID: args[1],
        userName: args[2],
        guest: args[3],
        level: args[4],
        team: (args[5] as number) ?? 1,
        avatar: args[6] ?? {},
      };

    case INCOMING_PACKET_IDS.PLAYER_LEAVE:
      return { type: 'PLAYER_LEAVE', id: args[0] };

    case INCOMING_PACKET_IDS.HOST_LEAVE:
      return { type: 'HOST_LEAVE', oldHostId: args[0], newHostId: args[1] };

    case INCOMING_PACKET_IDS.READY_CHANGE:
      return { type: 'READY_CHANGE', id: args[0], ready: args[1] };

    case INCOMING_PACKET_IDS.ALL_READY_RESET:
      return { type: 'ALL_READY_RESET' };

    case INCOMING_PACKET_IDS.USERNAME_CHANGE:
      return { type: 'USERNAME_CHANGE', id: args[0], newName: args[1] };

    case INCOMING_PACKET_IDS.TEAM_CHANGE:
      return { type: 'TEAM_CHANGE', id: args[0], team: args[1] };

    case INCOMING_PACKET_IDS.GAME_END:
      return { type: 'GAME_END' };

    case INCOMING_PACKET_IDS.GAME_START:
      return { type: 'GAME_START', timestamp: args[0] };

    case INCOMING_PACKET_IDS.TEAMLOCK_TOGGLE:
      return { type: 'TEAMLOCK_TOGGLE', locked: args[0] };

    case INCOMING_PACKET_IDS.CHAT_MESSAGE:
      return { type: 'CHAT_MESSAGE', id: args[0], message: args[1] };

    case INCOMING_PACKET_IDS.PLAYER_KICK:
      return { type: 'PLAYER_KICK', id: args[0] };

    case INCOMING_PACKET_IDS.GAMEMODE_CHANGE:
      return { type: 'GAMEMODE_CHANGE', engine: args[0], mode: args[1] };

    case INCOMING_PACKET_IDS.CHANGE_ROUNDS:
      return { type: 'CHANGE_ROUNDS', rounds: args[0] };

    case INCOMING_PACKET_IDS.MAP_SWITCH:
      return { type: 'MAP_SWITCH', data: args[0] };

    case INCOMING_PACKET_IDS.MAP_SUGGEST:
      return { type: 'MAP_SUGGEST', mapData: args[0], playerId: args[1] };

    case INCOMING_PACKET_IDS.MAP_SUGGEST_CLIENT:
      return { type: 'MAP_SUGGEST_CLIENT', mapTitle: args[0], mapAuthor: args[1], playerId: args[2] };

    case INCOMING_PACKET_IDS.BALANCE_SET:
      return { type: 'BALANCE_SET', playerId: args[0], balance: args[1] };

    case INCOMING_PACKET_IDS.COUNTDOWN:
      return { type: 'COUNTDOWN', n: args[0] };

    case INCOMING_PACKET_IDS.ABORT_COUNTDOWN:
      return { type: 'ABORT_COUNTDOWN' };

    case INCOMING_PACKET_IDS.PLAYER_LEVEL_UP: {
      const levelData = (args[0] as Record<string, unknown>) ?? {};
      return { type: 'PLAYER_LEVEL_UP', sid: levelData['sid'], lv: levelData['lv'], ...levelData };
    }

    case INCOMING_PACKET_IDS.TABBED:
      return { type: 'TABBED', id: args[0], tabbed: args[1] };

    case INCOMING_PACKET_IDS.ROOM_NAME_UPDATE:
      return { type: 'ROOM_NAME_UPDATE', newName: args[0] };

    case INCOMING_PACKET_IDS.ROOM_PASSWORD_UPDATE:
      return { type: 'ROOM_PASSWORD_UPDATE', hasPassword: args[0] };

    default:
      return null;
  }
}

/**
 * Decodifica e valida um packet incoming com zod (Phase 2+).
 *
 * Comportamento defensivo D-11:
 * - Usa safeParse — NUNCA lança exceção, mesmo com payload malformado.
 * - Falha de validação → UNKNOWN com raw preservado + log pino.warn.
 * - Packet com ID desconhecido → UNKNOWN imediatamente.
 *
 * @param packet Array [id, ...args] do socket.io-client@2.
 * @param logger Logger pino por sala (OBS-03 — injeção por instância).
 */
export function decodeWithZod(
  packet: [number, ...unknown[]],
  logger: Logger,
): IncomingPacket | UnknownPacket {
  const [type, ...args] = packet;

  const rawObj = buildRawObject(type, args);
  if (!rawObj) {
    return { type: 'UNKNOWN', raw: packet };
  }

  // D-11: safeParse — nunca lança (Pitfall 2 evitado).
  const result = IncomingPacketSchema.safeParse(rawObj);
  if (result.success) {
    return result.data;
  }

  logger.warn(
    { raw: packet, error: result.error.format() },
    'zod validation failed — emitting as UNKNOWN',
  );
  return { type: 'UNKNOWN', raw: packet };
}
