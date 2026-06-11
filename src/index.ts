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
export { decode } from './codec/decode.js';
export { encodeTimesync } from './codec/encode.js';
export { INCOMING_PACKET_IDS, OUTGOING_PACKET_IDS } from './codec/packets.js';
export type {
  TimesyncRequest,
  TimesyncResponse,
  StatusMessage,
  ShareLink,
  RoomCreated,
  UnknownPacket,
  IncomingPacket,
} from './codec/packets.js';
