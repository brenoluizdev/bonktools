// types.ts — contratos de interface do módulo room/.
// Fase 2: BonkRoomEvents, BonkRoomOptions, DesiredRoomState, RoomDeadReason.
// Padrão: interfaces TypeScript puras (sem zod), importáveis com `import type`.
// Análogo a transport/types.ts — mesmo papel para o módulo room/.

import type { Logger } from 'pino';
import type { ReconnectPolicy, ReconnectPolicyOptions } from './ReconnectPolicy.js';
import type { BonkTransportOptions } from '../transport/types.js';
import type { AuthOptions } from '../auth/types.js';
import type {
  RoomJoinPacket,
  PlayerJoinPacket,
  PlayerLeavePacket,
  TeamChangePacket,
  ReadyChangePacket,
  TabbedPacket,
  UsernameChangePacket,
  PlayerPingsPacket,
  StatusMessagePacket,
  ShareLinkPacket,
  RoomCreatedPacket,
  HostLeavePacket,
  AllReadyResetPacket,
  GameEndPacket,
  GameStartPacket,
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
  RoomNameUpdatePacket,
  RoomPasswordUpdatePacket,
  IncomingPacket,
  UnknownPacket,
} from '../codec/packets.js';

export type { ReconnectPolicy, ReconnectPolicyOptions };

// ─── RoomDeadReason ───────────────────────────────────────────────────────────

/**
 * Razão discriminada para a morte de uma sala.
 * D-07: distingue falhas terminais (sem retry) de transitórias (com retry).
 *
 * Terminal: status-banned, status-room_full, max-retries-exceeded.
 * Transitório: socket-disconnect → agenda scheduleRebuild().
 */
export type RoomDeadReason =
  | { kind: 'socket-disconnect'; cause: string }
  | { kind: 'status-banned' }
  | { kind: 'status-room_full' }
  | { kind: 'max-retries-exceeded'; attempts: number };

// ─── DesiredRoomState ─────────────────────────────────────────────────────────

/**
 * O que o caller QUER que a sala tenha — persiste através de rebuilds (D-09).
 *
 * SEGURANÇA T-2-03-03: NÃO inclui credenciais de conta (username/password de login).
 * Apenas configuração da sala. Logger pino nunca loga este objeto completo.
 */
export interface DesiredRoomState {
  roomName: string;
  /** Senha da sala (não credencial de conta). String vazia = sem senha. */
  password: string;
  maxPlayers: number;
  /** Modo de jogo: 'b', 'ar', 'ard', 'sp', 'v', 'f' etc. */
  mode: string | number;
  /** Engine: 'b', 'f' etc. */
  engine?: string;
  rounds: number;
  /** LZ-String blob ou null para mapa padrão (Fase 4 aplicará). */
  map?: string | null;
  /** Times habilitados (packet 32). Refletido no INFORM_IN_LOBBY (campo tea). */
  teamsEnabled?: boolean;
}

// ─── BonkRoomOptions ─────────────────────────────────────────────────────────

/**
 * Opções de construção do BonkRoom.
 *
 * - `desiredState`: configuração da sala (D-09).
 * - `transportOptions`: opções para instanciar BonkTransport (em modo real).
 * - `transport`: transport já instanciado para injeção em testes.
 * - `reconnectPolicy`: política de backoff (default: defaultReconnectPolicy()).
 * - `logger`: logger pino por instância (OBS-03 / Pitfall 4).
 */
export interface BonkRoomOptions {
  desiredState: DesiredRoomState;
  /** Usado em modo real (produção). Mutuamente exclusivo com `transport`. */
  transportOptions?: BonkTransportOptions;
  /** Transport injetado para testes de unidade (MockTransport). */
  transport?: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendPacket: (eventId: number, data: unknown) => void;
    getState?: () => string;
  };
  /** Política de reconexão (opções parciais — restante usa defaults). */
  reconnectPolicy?: ReconnectPolicyOptions;
  /** Logger pino por sala — Pitfall 4: nunca singleton de módulo. */
  logger?: Logger;
}

// ─── CreateRoomOptions / JoinRoomOptions ─────────────────────────────────────

/**
 * Endereço de sala já resolvido via AUTOJOIN ou manualmente.
 * Passado para joinRoom como alternativa a URL string (D-06 Fase 3).
 */
export interface ResolvedRoomAddress {
  /** hostname do servidor (ex: 'b2seattle1'). */
  server: string;
  /** endereço da sala (campo 'address' da resposta AUTOJOIN). */
  joinId: string;
  /** bypass da sala (passbypass do AUTOJOIN ou do URL). */
  bypass: string;
}

/**
 * Opções para createRoom() factory (D-01, D-03, D-04 Fase 3).
 * auth: GuestAuthOptions ou RegisteredAuthOptions.
 * desiredState: configuração da sala (roomName, password, maxPlayers, mode, rounds).
 */
export interface CreateRoomOptions {
  auth: AuthOptions;
  desiredState: DesiredRoomState;
  /**
   * Transport já instanciado para injeção em testes (mesmo contrato de
   * BonkRoomOptions.transport). Quando presente, a factory pula a autenticação
   * HTTP / server discovery e usa o transport diretamente. Produção não usa.
   */
  transport?: BonkRoomOptions['transport'];
  /** AuthClient já instanciado (BonkSession injeta o compartilhado). Quando ausente, cria um novo. */
  authClient?: import('../auth/AuthClient.js').AuthClient;
  /** Token já obtido (BonkSession pré-autentica). Quando ausente e auth.type==='registered', chama getToken. */
  token?: string;
  /** ID de banco de dados do usuário. Default: 2 (placeholder genérico). */
  dbid?: number;
  /** Sala oculta na lista pública. Default: false. */
  hidden?: boolean;
  /** Quickplay match. Default: false. */
  quick?: boolean;
  /** Nível mínimo para entrar. Default: 0. */
  minLevel?: number;
  /** Nível máximo para entrar. Default: 999. */
  maxLevel?: number;
  /** Timeout para receber o packet 49 (SHARE_LINK). Default: 10000 ms. */
  timeoutMs?: number;
  /** Versão do protocolo bonk.io. Default: 49. */
  protocolVersion?: number;
  reconnectPolicy?: ReconnectPolicyOptions;
  logger?: Logger;
}

/**
 * Opções para joinRoom() factory (D-06, D-07, D-08 Fase 3).
 */
export interface JoinRoomOptions {
  auth: AuthOptions;
  /**
   * Transport já instanciado para injeção em testes (mesmo contrato de
   * BonkRoomOptions.transport). Quando presente, a factory pula a resolução de
   * servidor (autojoin/discover) e usa o transport diretamente. Produção não usa.
   */
  transport?: BonkRoomOptions['transport'];
  /** 'host' (team=1) ou 'spectator' (team=0). Default: 'host'. */
  role?: 'host' | 'spectator';
  /** Senha da sala (se necessário). */
  password?: string;
  /** ID de banco de dados do usuário. Default: 2. */
  dbid?: number;
  /** Timeout para receber o packet 3 (ROOM_JOIN). Default: 10000 ms. */
  timeoutMs?: number;
  /** Versão do protocolo bonk.io. Default: 49. */
  protocolVersion?: number;
  reconnectPolicy?: ReconnectPolicyOptions;
  logger?: Logger;
}

// ─── Erros tipados de ciclo de vida ──────────────────────────────────────────

/**
 * Lançado por createRoom() quando o packet 49 (SHARE_LINK) não chega no timeoutMs (D-04).
 */
export class RoomCreationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`createRoom timed out after ${timeoutMs}ms — SHARE_LINK (packet 49) not received`);
    this.name = 'RoomCreationTimeoutError';
  }
}

/**
 * Lançado por joinRoom() quando o packet 3 (ROOM_JOIN) não chega no timeoutMs (D-08).
 */
export class RoomJoinTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`joinRoom timed out after ${timeoutMs}ms — ROOM_JOIN (packet 3) not received`);
    this.name = 'RoomJoinTimeoutError';
  }
}

// ─── BonkRoomEvents ───────────────────────────────────────────────────────────

/**
 * Mapa de eventos tipados do BonkRoom.
 * Consumido como generic: `class BonkRoom extends EventEmitter<BonkRoomEvents>`.
 *
 * D-05: payloads são os objetos decodificados diretamente (sem mapeamento).
 * D-06: raw-packet emite todo packet antes de qualquer reducer.
 * D-07: room-dead e room-rebuilt são eventos separados.
 */
export interface BonkRoomEvents {
  // ─── Roster events (MOD-01) ───────────────────────────────────────────────
  'room-join':       [packet: RoomJoinPacket];
  'player-join':     [packet: PlayerJoinPacket];
  'player-leave':    [packet: PlayerLeavePacket];
  'team-change':     [packet: TeamChangePacket];
  'ready-change':    [packet: ReadyChangePacket];
  'tabbed':          [packet: TabbedPacket];
  'username-change': [packet: UsernameChangePacket];
  'player-pings':    [packet: PlayerPingsPacket];

  // ─── Room lifecycle events ────────────────────────────────────────────────
  'room-created':  [packet: RoomCreatedPacket];
  'host-leave':    [packet: HostLeavePacket];
  'all-ready-reset': [packet: AllReadyResetPacket];
  'game-end':      [packet: GameEndPacket];
  'game-start':    [packet: GameStartPacket];

  // ─── Room config events ───────────────────────────────────────────────────
  'teamlock-toggle':     [packet: TeamlockTogglePacket];
  'gamemode-change':     [packet: GamemodeChangePacket];
  'change-rounds':       [packet: ChangeRoundsPacket];
  'map-switch':          [packet: MapSwitchPacket];
  'balance-set':         [packet: BalanceSetPacket];
  'room-name-update':    [packet: RoomNameUpdatePacket];
  'room-password-update':[packet: RoomPasswordUpdatePacket];

  // ─── Game flow events ─────────────────────────────────────────────────────
  'chat-message':    [packet: ChatMessagePacket];
  'player-kick':     [packet: PlayerKickPacket];
  'countdown':       [packet: CountdownPacket];
  'abort-countdown': [packet: AbortCountdownPacket];
  'player-level-up': [packet: PlayerLevelUpPacket];

  // ─── Link / status (OBS-02) ───────────────────────────────────────────────
  'status-message': [packet: StatusMessagePacket];
  'share-link':     [packet: ShareLinkPacket];

  // ─── Room lifecycle (D-07) ────────────────────────────────────────────────
  'room-dead':    [reason: RoomDeadReason];
  'room-rebuilt': [shareLink: string];

  // ─── Debug / extensibilidade (D-06) ──────────────────────────────────────
  'raw-packet': [packet: IncomingPacket | UnknownPacket];
}
