import type { TimesyncRequest } from './packets.js';
import { OUTGOING_PACKET_IDS } from './packets.js';

// D-06: encode Phase 1 cobre APENAS packets de handshake/keep-alive.
// encodeCreateRoom (12) e encodeJoinRoom (13) pertencem a fases futuras — NÃO aqui.

/**
 * Codifica o request de timesync (packet outgoing 18).
 * Pitfall 2: timesync SAI como 18 (CLIENT_MESSAGE_TYPES.TIMESYNC), não 23.
 */
export function encodeTimesync(
  id: number,
): [typeof OUTGOING_PACKET_IDS.TIMESYNC, TimesyncRequest] {
  return [OUTGOING_PACKET_IDS.TIMESYNC, { jsonrpc: '2.0', id, method: 'timesync' }];
}
