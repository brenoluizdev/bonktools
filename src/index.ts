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
export { encodeTimesync } from './codec/encode.js';
export { INCOMING_PACKET_IDS, OUTGOING_PACKET_IDS, TERMINAL_STATUS_CODES, RATE_LIMIT_CODES } from './codec/packets.js';
export type {
  TimesyncRequest,
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
export type {
  BonkRoomOptions,
  BonkRoomEvents,
  DesiredRoomState,
  RoomDeadReason,
} from './room/types.js';
export type { RoomState, PlayerData } from './room/RoomState.js';
export type { ReconnectPolicy, ReconnectPolicyOptions } from './room/ReconnectPolicy.js';
