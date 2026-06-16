import type {
  TimesyncRequest,
  CreateRoomPayload,
  JoinRoomPayload,
  SetRoomNamePayload,
  SetRoomPasswordPayload,
} from './packets.js';
import { OUTGOING_PACKET_IDS } from './packets.js';

// D-06: encode Phase 1 cobria APENAS packets de handshake/keep-alive.
// Phase 3 adiciona os encoders de ciclo de vida (create/join/setters).

/**
 * Codifica o request de timesync (packet outgoing 18).
 * Pitfall 2: timesync SAI como 18 (CLIENT_MESSAGE_TYPES.TIMESYNC), não 23.
 */
export function encodeTimesync(
  id: number,
): [typeof OUTGOING_PACKET_IDS.TIMESYNC, TimesyncRequest] {
  return [OUTGOING_PACKET_IDS.TIMESYNC, { jsonrpc: '2.0', id, method: 'timesync' }];
}

/** Codifica o packet de criação de sala (outgoing 12). */
export function encodeCreateRoom(
  payload: CreateRoomPayload,
): [typeof OUTGOING_PACKET_IDS.CREATE_ROOM, CreateRoomPayload] {
  return [OUTGOING_PACKET_IDS.CREATE_ROOM, payload];
}

/** Codifica o packet de entrada em sala (outgoing 13). */
export function encodeJoinRoom(
  payload: JoinRoomPayload,
): [typeof OUTGOING_PACKET_IDS.JOIN_ROOM, JoinRoomPayload] {
  return [OUTGOING_PACKET_IDS.JOIN_ROOM, payload];
}

/** Codifica o packet de atualização de nome da sala (outgoing 52). */
export function encodeSetRoomName(
  name: string,
): [typeof OUTGOING_PACKET_IDS.SET_ROOM_NAME, SetRoomNamePayload] {
  return [OUTGOING_PACKET_IDS.SET_ROOM_NAME, { newName: name }];
}

/** Codifica o packet de atualização de senha da sala (outgoing 53). */
export function encodeSetRoomPassword(
  password: string,
): [typeof OUTGOING_PACKET_IDS.SET_ROOM_PASSWORD, SetRoomPasswordPayload] {
  return [OUTGOING_PACKET_IDS.SET_ROOM_PASSWORD, { newPass: password }];
}
