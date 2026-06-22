import type {
  TimesyncRequest,
  CreateRoomPayload,
  JoinRoomPayload,
  SetRoomNamePayload,
  SetRoomPasswordPayload,
  StartGamePayload,
  StartGameOptions,
} from './packets.js';
import { OUTGOING_PACKET_IDS } from './packets.js';
import type { DesiredRoomState } from '../room/types.js';

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

/**
 * Monta o payload do TRIGGER_START (outgoing 5) a partir de DesiredRoomState.
 * ATENÇÃO: o servidor ECOA o `is` de volta sem modificar. Com is='' o GAME_START
 * chega com is='' e o client bonk.io falha ao inicializar a engine de física.
 * Passe opts.is com um blob LZ-String válido capturado de uma sessão real.
 */
export function encodeStartGame(
  state: DesiredRoomState,
  opts?: StartGameOptions,
): StartGamePayload {
  const gs = {
    map: state.map ?? '',
    gt: 2,
    wl: state.rounds,
    q: false,
    tl: false,
    tea: state.teamsEnabled ?? false,
    ga: state.engine ?? 'b',
    mo: String(state.mode || 'b'),
    bal: {} as Record<number, number>,
    ...(opts?.gs ? Object.fromEntries(Object.entries(opts.gs).filter(([, v]) => v !== undefined)) : {}),
  };
  return { is: opts?.is ?? '', gs };
}
