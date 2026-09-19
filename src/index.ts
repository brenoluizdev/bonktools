// Phase 1 exports — apenas o que esta fase entrega (D-09).

// Transport
export { BonkTransport } from './transport/BonkTransport.js';
export type {
  BonkTransportOptions,
  ConnectionState,
  TlsMode,
  AuthOptions,
  ServerInfo,
} from './transport/types.js';

// Auth
export { AuthClient } from './auth/AuthClient.js';
export type {
  GuestAuthOptions,
  RegisteredAuthOptions,
  LoginResponse,
  GetRoomsRequest,
  ConnectOptions,
} from './auth/types.js';

// Codec
export { decode, decodeWithZod } from './codec/decode.js';
export { encodeTimesync, encodeStartGame } from './codec/encode.js';
export { decodeInitialState, encodeInitialState, remapInitialStatePlayers } from './codec/initialState.js';
export type { InitialState } from './codec/initialState.js';
export { INCOMING_PACKET_IDS, OUTGOING_PACKET_IDS, TERMINAL_STATUS_CODES, RATE_LIMIT_CODES } from './codec/packets.js';
export type {
  TimesyncRequest,
  TimesyncPacket,
  TimesyncResponse,
  StatusMessage,
  ShareLink,
  RoomCreated,
  UnknownPacket,
  IncomingPacket,
  StatusCode,
  RoomJoinPacket,
  PlayerJoinPacket,
  PlayerLeavePacket,
  HostLeavePacket,
  ReadyChangePacket,
  AllReadyResetPacket,
  UsernameChangePacket,
  TeamChangePacket,
  GameEndPacket,
  GameStartPacket,
  StatusMessagePacket,
  ShareLinkPacket,
  TeamlockTogglePacket,
  ChatMessagePacket,
  PlayerKickPacket,
  GamemodeChangePacket,
  ChangeRoundsPacket,
  MapSwitchPacket,
  MapSuggestPacket,
  MapSuggestClientPacket,
  BalanceSetPacket,
  CountdownPacket,
  AbortCountdownPacket,
  PlayerLevelUpPacket,
  PlayerPingsPacket,
  TabbedPacket,
  RoomCreatedPacket,
  RoomNameUpdatePacket,
  RoomPasswordUpdatePacket,
} from './codec/packets.js';

// Room — Phase 2
export { BonkRoom } from './room/BonkRoom.js';
export { AFK_THRESHOLD_MS } from './room/AntiAfk.js';
export type { AntiAfkOptions } from './room/AntiAfk.js';
export type {
  BonkRoomOptions,
  BonkRoomEvents,
  PeerInputEvent,
  DesiredRoomState,
  RoomDeadReason,
} from './room/types.js';
export { createEmptyRoomState } from './room/RoomState.js';
export type { RoomState, PlayerData } from './room/RoomState.js';
export { computeBackoff, defaultReconnectPolicy } from './room/ReconnectPolicy.js';
export type { ReconnectPolicy, ReconnectPolicyOptions } from './room/ReconnectPolicy.js';

// Room Lifecycle — Phase 3
export { createRoom, joinRoom } from './room/factories.js';
export type {
  CreateRoomOptions,
  JoinRoomOptions,
  ResolvedRoomAddress,
} from './room/types.js';
export { RoomCreationTimeoutError, RoomJoinTimeoutError } from './room/types.js';
export {
  encodeCreateRoom,
  encodeJoinRoom,
  encodeSetRoomName,
  encodeSetRoomPassword,
} from './codec/encode.js';
export type {
  CreateRoomPayload,
  JoinRoomPayload,
  SetRoomNamePayload,
  SetRoomPasswordPayload,
  // Phase 4 payload types
  GameSettings,
  StartGamePayload,
  StartGameOptions,
  KickBanPayload,
  ChatMessagePayload,
  SendModePayload,
  SendRoundsPayload,
  SendMapAddPayload,
  ChangeOtherTeamPayload,
  TeamLockPayload,
  SendTeamSettingsPayload,
  SendHostChangePayload,
  StartCountdownPayload,
} from './codec/packets.js';
export type { AutoJoinResponse } from './auth/types.js';

// Session — Phase 5
export { BonkSession } from './session/BonkSession.js';
export { AccountThrottle } from './session/AccountThrottle.js';
export type {
  RoomStatus,
  RoomConfig,
  AccountThrottleOptions,
  BonkSessionEvents,
  BonkSessionOptions,
} from './session/types.js';

// Teams
export { TEAM_SPEC, TEAM_FFA, TEAM_BLUE, TEAM_RED, TEAM_GREEN, TEAM_YELLOW } from './room/teams.js';

// Football
export { FOOTBALL_DEFAULT_BLOBS, getFootballDefaultBlob } from './football/defaultBlobs.js';

// Outros gamemodes (classic, arrows, death arrows, grapple, vtol)
export { GAMEMODE_DEFAULT_BLOBS, getGamemodeDefaultBlob } from './gamemodes/defaultBlobs.js';

// Cache local de IS blobs por mapa (substitui os defaults estáticos acima,
// que só são válidos se a sala estiver no MESMO mapa em que foram capturados).
export { MapBlobCache, hashMap, DEFAULT_MAP_ID } from './cache/mapBlobCache.js';
