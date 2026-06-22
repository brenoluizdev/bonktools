// Interfaces TypeScript Phase 1 para os packets de handshake/keep-alive.
// D-04: TypeScript interfaces simples, sem zod.
// IDs canônicos retirados de BonkBot constants.js (SERVER_MESSAGE_TYPES / CLIENT_MESSAGE_TYPES).
// Phase 2: expandido com 25+ zod schemas, StatusCode union, discriminated union (D-10, D-12).

import { z } from 'zod';

// ─── Avatar schema (opaco — passthrough para não rejeitar campos extras) ──────

const AvatarSchema = z.object({
  layers: z.array(z.unknown()),
  bc: z.number(),
}).passthrough();

// ─── PlayerData raw (dentro do array de packet 3) ─────────────────────────────

const PlayerDataRawSchema = z.object({
  peerID: z.string(),
  userName: z.string(),
  guest: z.boolean(),
  team: z.number(),
  level: z.number(),
  ready: z.boolean(),
  tabbed: z.boolean(),
  avatar: AvatarSchema,
});

// ─── Schemas individuais dos 25+ packets ─────────────────────────────────────

export const RoomCreatedSchema = z.object({
  type: z.literal('ROOM_CREATED'),
  sockId: z.string(),
  myId: z.number(),
});

export const RoomJoinSchema = z.object({
  type: z.literal('ROOM_JOIN'),
  myId: z.number(),
  hostId: z.number(),
  players: z.array(z.union([PlayerDataRawSchema, z.null()])),
  timestamp: z.number(),
  teamsLocked: z.boolean(),
  roomId: z.number(),
  roomBypass: z.string(),
});

export const PlayerJoinSchema = z.object({
  type: z.literal('PLAYER_JOIN'),
  id: z.number(),
  peerID: z.string(),
  userName: z.string(),
  guest: z.boolean(),
  level: z.number(),
  team: z.number(),
  // ready e tabbed opcionais — não estão em todos os payloads de PLAYER_JOIN (Packets.md
  // não documenta explicitamente, mas são incluídos em alguns contextos de servidor).
  ready: z.boolean().optional(),
  tabbed: z.boolean().optional(),
  avatar: z.unknown(),
});

export const PlayerLeaveSchema = z.object({
  type: z.literal('PLAYER_LEAVE'),
  id: z.number(),
});

export const HostLeaveSchema = z.object({
  type: z.literal('HOST_LEAVE'),
  oldHostId: z.number(),
  newHostId: z.number(),
});

export const ReadyChangeSchema = z.object({
  type: z.literal('READY_CHANGE'),
  id: z.number(),
  ready: z.boolean(),
});

export const AllReadyResetSchema = z.object({
  type: z.literal('ALL_READY_RESET'),
});

export const UsernameChangeSchema = z.object({
  type: z.literal('USERNAME_CHANGE'),
  id: z.number(),
  newName: z.string(),
});

export const TeamChangeSchema = z.object({
  type: z.literal('TEAM_CHANGE'),
  id: z.number(),
  team: z.number(),
});

export const GameEndSchema = z.object({
  type: z.literal('GAME_END'),
});

export const GameStartSchema = z.object({
  type: z.literal('GAME_START'),
  timestamp: z.unknown(),
  /** Blob de estado inicial LZ-compressed. Pode ser null (servidor envia null quando is='') */
  is: z.string().nullable().optional(),
  /** Game settings no momento do start. */
  gs: z.unknown().optional(),
});

export const StatusMessageSchema = z.object({
  type: z.literal('STATUS_MESSAGE'),
  status: z.string(),
});

export const ShareLinkSchema = z.object({
  type: z.literal('SHARE_LINK'),
  roomId: z.number(),
  bypass: z.string(),
});

export const TeamlockToggleSchema = z.object({
  type: z.literal('TEAMLOCK_TOGGLE'),
  locked: z.boolean(),
});

export const ChatMessageSchema = z.object({
  type: z.literal('CHAT_MESSAGE'),
  id: z.number(),
  message: z.string(),
});

export const PlayerKickSchema = z.object({
  type: z.literal('PLAYER_KICK'),
  id: z.number(),
});

export const GamemodeChangeSchema = z.object({
  type: z.literal('GAMEMODE_CHANGE'),
  engine: z.string(),
  mode: z.string(),
});

export const ChangeRoundsSchema = z.object({
  type: z.literal('CHANGE_ROUNDS'),
  rounds: z.number(),
});

export const MapSwitchSchema = z.object({
  type: z.literal('MAP_SWITCH'),
  data: z.unknown(),
});

export const MapSuggestSchema = z.object({
  type: z.literal('MAP_SUGGEST'),
  mapData: z.unknown(),
  playerId: z.number(),
});

export const MapSuggestClientSchema = z.object({
  type: z.literal('MAP_SUGGEST_CLIENT'),
  mapTitle: z.string(),
  mapAuthor: z.string(),
  playerId: z.number(),
});

export const BalanceSetSchema = z.object({
  type: z.literal('BALANCE_SET'),
  playerId: z.number(),
  balance: z.number(),
});

export const CountdownSchema = z.object({
  type: z.literal('COUNTDOWN'),
  n: z.number(),
});

export const AbortCountdownSchema = z.object({
  type: z.literal('ABORT_COUNTDOWN'),
});

export const PlayerLevelUpSchema = z.object({
  type: z.literal('PLAYER_LEVEL_UP'),
  sid: z.unknown(),
  lv: z.unknown(),
}).passthrough();

export const PlayerPingsSchema = z.object({
  type: z.literal('PLAYER_PINGS'),
  pings: z.record(z.string(), z.number()),
  pingId: z.number(),
});

export const TimesyncSchema = z.object({
  type: z.literal('TIMESYNC'),
  time: z.number(),
  id: z.number(),
});

export const RoomNameUpdateSchema = z.object({
  type: z.literal('ROOM_NAME_UPDATE'),
  newName: z.string(),
});

export const RoomPasswordUpdateSchema = z.object({
  type: z.literal('ROOM_PASSWORD_UPDATE'),
  hasPassword: z.number(),
});

export const TabbedSchema = z.object({
  type: z.literal('TABBED'),
  id: z.number(),
  tabbed: z.boolean(),
});

// ─── Discriminated union de todos os packets incoming ────────────────────────
// D-10: z.discriminatedUnion('type', [...]) valida em runtime E infere union type.
// UnknownPacket NÃO entra na union — é gerado pelo decoder quando safeParse falha.

export const IncomingPacketSchema = z.discriminatedUnion('type', [
  RoomCreatedSchema,
  RoomJoinSchema,
  PlayerJoinSchema,
  PlayerLeaveSchema,
  HostLeaveSchema,
  ReadyChangeSchema,
  AllReadyResetSchema,
  UsernameChangeSchema,
  TeamChangeSchema,
  GameEndSchema,
  GameStartSchema,
  StatusMessageSchema,
  ShareLinkSchema,
  TeamlockToggleSchema,
  ChatMessageSchema,
  PlayerKickSchema,
  GamemodeChangeSchema,
  ChangeRoundsSchema,
  MapSwitchSchema,
  MapSuggestSchema,
  MapSuggestClientSchema,
  BalanceSetSchema,
  CountdownSchema,
  AbortCountdownSchema,
  PlayerLevelUpSchema,
  PlayerPingsSchema,
  TimesyncSchema,
  RoomNameUpdateSchema,
  RoomPasswordUpdateSchema,
  TabbedSchema,
]);

// ─── Tipos inferidos dos schemas ──────────────────────────────────────────────

export type RoomCreatedPacket = z.infer<typeof RoomCreatedSchema>;
export type RoomJoinPacket = z.infer<typeof RoomJoinSchema>;
export type PlayerJoinPacket = z.infer<typeof PlayerJoinSchema>;
export type PlayerLeavePacket = z.infer<typeof PlayerLeaveSchema>;
export type HostLeavePacket = z.infer<typeof HostLeaveSchema>;
export type ReadyChangePacket = z.infer<typeof ReadyChangeSchema>;
export type AllReadyResetPacket = z.infer<typeof AllReadyResetSchema>;
export type UsernameChangePacket = z.infer<typeof UsernameChangeSchema>;
export type TeamChangePacket = z.infer<typeof TeamChangeSchema>;
export type GameEndPacket = z.infer<typeof GameEndSchema>;
export type GameStartPacket = z.infer<typeof GameStartSchema>;
export type StatusMessagePacket = z.infer<typeof StatusMessageSchema>;
export type ShareLinkPacket = z.infer<typeof ShareLinkSchema>;
export type TeamlockTogglePacket = z.infer<typeof TeamlockToggleSchema>;
export type ChatMessagePacket = z.infer<typeof ChatMessageSchema>;
export type PlayerKickPacket = z.infer<typeof PlayerKickSchema>;
export type GamemodeChangePacket = z.infer<typeof GamemodeChangeSchema>;
export type ChangeRoundsPacket = z.infer<typeof ChangeRoundsSchema>;
export type MapSwitchPacket = z.infer<typeof MapSwitchSchema>;
export type MapSuggestPacket = z.infer<typeof MapSuggestSchema>;
export type MapSuggestClientPacket = z.infer<typeof MapSuggestClientSchema>;
export type BalanceSetPacket = z.infer<typeof BalanceSetSchema>;
export type CountdownPacket = z.infer<typeof CountdownSchema>;
export type AbortCountdownPacket = z.infer<typeof AbortCountdownSchema>;
export type PlayerLevelUpPacket = z.infer<typeof PlayerLevelUpSchema>;
export type PlayerPingsPacket = z.infer<typeof PlayerPingsSchema>;
export type TimesyncPacket = z.infer<typeof TimesyncSchema>;
export type RoomNameUpdatePacket = z.infer<typeof RoomNameUpdateSchema>;
export type RoomPasswordUpdatePacket = z.infer<typeof RoomPasswordUpdateSchema>;
export type TabbedPacket = z.infer<typeof TabbedSchema>;

/**
 * Packet não mapeado — mantém o array original em `raw` para inspeção defensiva (T-1-T1).
 * NÃO entra no IncomingPacketSchema — é gerado pelo decoder quando safeParse falha (D-11).
 */
export interface UnknownPacket {
  type: 'UNKNOWN';
  raw: [number, ...unknown[]];
}

/**
 * Union de todos os packets que o codec Phase 2 sabe decodificar (via zod).
 * Phase 1 retrocompatibilidade: inclui UnknownPacket como possível resultado.
 */
export type IncomingPacket = z.infer<typeof IncomingPacketSchema> | UnknownPacket;

// ─── Aliases de retrocompatibilidade Phase 1 ──────────────────────────────────
// Mantidos para não quebrar importações existentes (D-02).

/** @deprecated Use TimesyncPacket */
export type TimesyncResponse = TimesyncPacket;

/** @deprecated Use StatusMessagePacket */
export type StatusMessage = StatusMessagePacket;

/** @deprecated Use ShareLinkPacket */
export type ShareLink = ShareLinkPacket;

/** @deprecated Use RoomCreatedPacket */
export type RoomCreated = RoomCreatedPacket;

/**
 * Request de timesync enviado pelo client (packet outgoing 18).
 */
export interface TimesyncRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'timesync';
}

// ─── StatusCode union — todos os 26 status codes conhecidos (OBS-02) ─────────
// Fonte: DemystifyBonk/Packets.md + BonkBot/src/utils/constants.js
// Nota: 'Initial data timeout.' inclui ponto final (literal do servidor).
// Nota: 'Connect error' inclui espaço (literal do servidor).
// Nota: 'arm rate limited' inclui espaço (literal do servidor).

export type StatusCode =
  // Rate limits (OBS-04 — rate-limit awareness)
  | 'arm rate limited'            // save replay spam
  | 'rate_limit_ready'           // [READY] button spam
  | 'join_rate_limited'          // join rooms too quickly
  | 'host_change_rate_limited'   // give host too fast
  | 'rate_limit_mapsuggest'      // map suggest too fast
  | 'rate_limit_countdown'       // countdown messages too fast
  | 'rate_limit_abortcountdown'  // abort countdown too fast
  | 'rate_limit_sma'             // map change too fast
  | 'rate_limit_cot'             // team change too fast
  | 'rate_limit_sgt'             // mode change too fast
  | 'rate_limit_rtl'             // return to lobby too fast
  | 'rate_limit_pong'            // ping packet too fast
  | 'rate_limit_tl'              // team lock too fast
  | 'rate_limit'                 // generic rate limit
  // Terminal (D-08 — aborta reconexão)
  | 'banned'                     // kickado com ban
  | 'room_full'                  // sala cheia ao tentar entrar
  // Outros erros
  | 'room_not_found'             // sala não existe mais
  | 'no_client_entry'            // ação sem estar numa sala
  | 'already_in_this_room'       // tentando entrar em sala que já está
  | 'password_wrong'             // senha errada
  | 'guest'                      // ação requer conta registrada
  | 'old_rotation'               // quickplay related
  | 'not_hosting'                // ação requer ser host
  | 'cant_ban_yourself'          // auto-ban
  | 'Initial data timeout.'      // inclui ponto final (literal do servidor)
  | 'Connect error';             // inclui espaço (literal do servidor)

/** Codes que indicam falha TERMINAL — reconexão deve parar (D-08). */
export const TERMINAL_STATUS_CODES = new Set<StatusCode>(['banned', 'room_full']);

/** Codes que são rate-limits (OBS-04). */
export const RATE_LIMIT_CODES = new Set<StatusCode>([
  'rate_limit',
  'rate_limit_ready',
  'join_rate_limited',
  'host_change_rate_limited',
  'rate_limit_mapsuggest',
  'rate_limit_countdown',
  'rate_limit_abortcountdown',
  'rate_limit_sma',
  'rate_limit_cot',
  'rate_limit_sgt',
  'rate_limit_rtl',
  'rate_limit_pong',
  'rate_limit_tl',
  'arm rate limited',
]);

/**
 * IDs numéricos dos packets que chegam do servidor (server→client).
 * Pitfall 2: NÃO confundir com OUTGOING_PACKET_IDS — TIMESYNC entra como 23.
 */
export const INCOMING_PACKET_IDS = {
  PLAYER_PINGS: 1,
  ROOM_CREATED: 2,
  JOIN_ROOM: 3,
  PLAYER_JOIN: 4,
  PLAYER_LEAVE: 5,
  HOST_LEAVE: 6,
  READY_CHANGE: 8,
  ALL_READY_RESET: 9,
  USERNAME_CHANGE: 12,
  GAME_END: 13,
  GAME_START: 15,
  STATUS_MESSAGE: 16,
  TEAM_CHANGE: 18,
  TEAMLOCK_TOGGLE: 19,
  CHAT_MESSAGE: 20,
  TIMESYNC: 23,
  PLAYER_KICK: 24,
  GAMEMODE_CHANGE: 26,
  CHANGE_ROUNDS: 27,
  MAP_SWITCH: 29,
  MAP_SUGGEST: 33,
  MAP_SUGGEST_CLIENT: 34,
  BALANCE_SET: 36,
  COUNTDOWN: 43,
  ABORT_COUNTDOWN: 44,
  PLAYER_LEVEL_UP: 45,
  SHARE_LINK: 49,
  TABBED: 52,
  ROOM_NAME_UPDATE: 58,
  ROOM_PASSWORD_UPDATE: 59,
} as const;

/**
 * IDs numéricos dos packets enviados pelo client (client→server).
 * Pitfall 2: TIMESYNC sai como 18 (não 23).
 *
 * ATENÇÃO: IDs outgoing e incoming são namespaces DISTINTOS no protocolo bonk.io.
 * O mesmo número pode representar packets diferentes dependendo da direção.
 * Ex: outgoing 52 = SET_ROOM_NAME; incoming 52 = TABBED.
 */
export const OUTGOING_PACKET_IDS = {
  TIMESYNC: 18,
  CREATE_ROOM: 12,
  JOIN_ROOM: 13,
  // INFORM_IN_LOBBY: enviado pelo host ao receber PLAYER_JOIN para entregar dados iniciais ao jogador.
  // Sem esse packet, o jogador vê "Initial data timeout." (protocolo obrigatório).
  INFORM_IN_LOBBY: 11,
  SET_ROOM_NAME: 52,
  SET_ROOM_PASSWORD: 53,
  // Phase 4 — game flow e moderation
  // ATENÇÃO Phase 4: outgoing 10 (CHAT_MESSAGE) != incoming 20 (CHAT_MESSAGE) — namespaces distintos.
  TRIGGER_START: 5,
  // Muda o próprio time (self-move). Payload: { targetTeam: number }.
  // Diferente de CHANGE_OTHER_TEAM_OTHER (26) que move outro jogador.
  CHANGE_OWN_TEAM: 6,
  TEAM_LOCK: 7,
  KICK_BAN_PLAYER: 9,
  CHAT_MESSAGE: 10,
  RETURN_TO_LOBBY: 14,
  SEND_MODE: 20,
  SEND_ROUNDS: 21,
  SEND_MAP_DELETE: 22,
  SEND_MAP_ADD: 23,
  CHANGE_OTHER_TEAM_OTHER: 26,
  SEND_TEAM_SETTINGS: 32,
  SEND_HOST_CHANGE: 34,
  // SET_READY: marca o SENDER como ready (true) ou not-ready (false). Packet 16.
  // Apenas altera o próprio status — não pode forçar ready de outros jogadores.
  SET_READY: 16,
  // ALL_READY_RESET: host reseta o status de ready de TODOS para false. Packet 17.
  ALL_READY_RESET: 17,
  SEND_START_COUNTDOWN: 36,
  SEND_ABORT_COUNTDOWN: 37,
  SEND_NO_HOST_SWAP: 50,
} as const;

// ─── Payloads de outgoing packets Phase 3 ─────────────────────────────────────

export interface CreateRoomPayload {
  peerID: string;
  roomName: string;
  maxPlayers: number;
  password: string;
  dbid: number;
  guest: boolean;
  minLevel: number;
  maxLevel: number;
  latitude: number;
  longitude: number;
  country: string;
  version: number;
  hidden: number;
  quick: boolean;
  mode: string;
  token?: string;
  guestName?: string;
  avatar: { layers: unknown[]; bc: number };
}

export interface JoinRoomPayload {
  joinID: string;
  avatar: { layers: unknown[]; bc: number };
  guest: boolean;
  dbid: number;
  version: number;
  peerID: string;
  bypass: string;
  token?: string;
  guestName?: string;
  roomPassword?: string;
  /** Team ao entrar: 0=espectador, 1=host/ffa. Omitir = default do servidor. */
  team?: number;
}

export interface SetRoomNamePayload {
  newName: string;
}

export interface SetRoomPasswordPayload {
  newPass: string;
}

// ─── Payloads de outgoing packets Phase 4 ─────────────────────────────────────

export interface GameSettings {
  map: string;
  /** Game type. Default: 2 */
  gt: number;
  wl: number;
  q: boolean;
  tl: boolean;
  tea: boolean;
  /** Game engine (e.g. "b" = bonk, "ar" = arrow). */
  ga: string;
  /** Game mode (e.g. "b" = default). */
  mo: string;
  bal: Record<number, number> | unknown[];
}

export interface StartGamePayload {
  /** Initial state blob captured from ROOM_JOIN packet. */
  is: string;
  gs: GameSettings;
}

export interface StartGameOptions {
  /** Initial state blob — if omitted, uses DEFAULT_IS_BLOB captured during spike. */
  is?: string;
  gs?: Partial<GameSettings>;
}

export interface KickBanPayload {
  banshortid: number;
  /** Present only for kick; absent for ban. */
  kickonly?: true;
}

export interface ChatMessagePayload {
  message: string;
}

export interface SendModePayload {
  ga: string;
  mo: string;
}

export interface SendRoundsPayload {
  w: number;
}

export interface SendMapAddPayload {
  m: string;
}

export interface ChangeOtherTeamPayload {
  targetID: number;
  /** 0=spec 1=ffa 2=red 3=blue 4=green 5=yellow */
  targetTeam: number;
}

export interface TeamLockPayload {
  teamLock: boolean;
}

export interface SendTeamSettingsPayload {
  t: boolean;
}

export interface SendHostChangePayload {
  id: number;
}

export interface StartCountdownPayload {
  /** Countdown seconds. Defaults to 3 when omitted by caller. */
  num: number;
}

/** Payload do INFORM_IN_LOBBY (outgoing 11) — enviado pelo host quando um jogador entra. */
export interface InformInLobbyPayload {
  /** ID do jogador que acabou de entrar (packet.id do PLAYER_JOIN). */
  sid: number;
  gs: {
    /** Dados do mapa atual (objeto raw, não LZ-string). */
    map: unknown;
    /** Game type. 2 = padrão. */
    gt: number;
    /** Win limit (rounds). */
    wl: number;
    /** Quick play. */
    q: boolean;
    /** Teams locked. */
    tl: boolean;
    /** Teams enabled. */
    tea: boolean;
    /** Game engine (ex: "b" = bonk, "f" = football). */
    ga: string;
    /** Game mode (ex: "b" = classic). */
    mo: string;
    /** Balanços por jogador ID. */
    bal: Record<number, number> | unknown[];
  };
}
