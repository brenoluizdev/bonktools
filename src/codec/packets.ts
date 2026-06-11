// Interfaces TypeScript Phase 1 para os packets de handshake/keep-alive.
// D-04: TypeScript interfaces simples, sem zod.
// IDs canônicos retirados de BonkBot constants.js (SERVER_MESSAGE_TYPES / CLIENT_MESSAGE_TYPES).

/**
 * Request de timesync enviado pelo client (packet outgoing 18).
 */
export interface TimesyncRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'timesync';
}

/**
 * Resposta de timesync recebida do servidor (packet incoming 23).
 */
export interface TimesyncResponse {
  type: 'TIMESYNC';
  /** Unix timestamp em ms reportado pelo servidor. */
  time: number;
  id: number;
}

/**
 * Mensagem de status do servidor (packet incoming 16).
 * Valores conhecidos: 'rate_limit_ready', 'room_full', 'banned', 'join_rate_limited', etc.
 */
export interface StatusMessage {
  type: 'STATUS_MESSAGE';
  status: string;
}

/**
 * Share link da sala (packet incoming 49).
 * URL = 'https://bonk.io/' + roomId + bypass.
 */
export interface ShareLink {
  type: 'SHARE_LINK';
  roomId: number;
  bypass: string;
}

/**
 * Confirmação de criação de sala (packet incoming 2).
 */
export interface RoomCreated {
  type: 'ROOM_CREATED';
  sockId: string;
  myId: number;
}

/**
 * Packet não mapeado no Phase 1. Mantém o array original em `raw`
 * para inspeção defensiva (boundary server→codec, T-1-T1).
 */
export interface UnknownPacket {
  type: 'UNKNOWN';
  raw: [number, ...unknown[]];
}

/**
 * Union de todos os packets que o codec Phase 1 sabe decodificar.
 */
export type IncomingPacket =
  | TimesyncResponse
  | StatusMessage
  | ShareLink
  | RoomCreated
  | UnknownPacket;

/**
 * IDs numéricos dos packets que chegam do servidor (server→client).
 * Pitfall 2: NÃO confundir com OUTGOING_PACKET_IDS — TIMESYNC entra como 23.
 */
export const INCOMING_PACKET_IDS = {
  ROOM_CREATED: 2,
  STATUS_MESSAGE: 16,
  TIMESYNC: 23,
  SHARE_LINK: 49,
} as const;

/**
 * IDs numéricos dos packets enviados pelo client (client→server).
 * Pitfall 2: TIMESYNC sai como 18 (não 23).
 */
export const OUTGOING_PACKET_IDS = {
  TIMESYNC: 18,
} as const;
