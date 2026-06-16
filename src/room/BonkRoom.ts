// BonkRoom.ts — classe principal da Fase 2.
// Envolve BonkTransport (detalhe de implementação), expõe EventEmitter3<BonkRoomEvents>.
// Implementa roster routing via reducers puros + máquina de estados de reconexão.
// D-01: BonkRoom é a interface pública; BonkTransport vira detalhe interno.

import EventEmitter from 'eventemitter3'; // Pitfall 6: default import, não named
import pino from 'pino';
import type { Logger } from 'pino';
import { BonkTransport } from '../transport/BonkTransport.js';
import { decodeWithZod } from '../codec/decode.js';
import { TERMINAL_STATUS_CODES } from '../codec/packets.js';
import type { StatusCode, IncomingPacket, UnknownPacket } from '../codec/packets.js';
import {
  createEmptyRoomState,
  reduceRoomJoin,
  reducePlayerJoin,
  reducePlayerLeave,
  reduceTeamChange,
  reduceReadyChange,
  reduceTabbedChange,
  reduceUsernameChange,
  reducePlayerPings,
} from './RoomState.js';
import { defaultReconnectPolicy, computeBackoff } from './ReconnectPolicy.js';
import type { BonkRoomEvents, BonkRoomOptions, RoomDeadReason } from './types.js';
import type { RoomState } from './RoomState.js';
import type { ReconnectPolicy } from './ReconnectPolicy.js';

// Tipo mínimo para o transport injetado (real ou mock nos testes)
type TransportLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendPacket: (eventId: number, data: unknown) => void;
  getState?: () => string;
};

/**
 * BonkRoom — interface pública da Fase 2.
 *
 * Gerencia o ciclo de vida completo de uma sala bonk.io:
 * - Conexão e reconexão automática com backoff exponencial
 * - Roster autoritativo via reducers puros (MOD-01)
 * - 29 eventos tipados via EventEmitter3<BonkRoomEvents> (OBS-01)
 * - Logger pino por instância (OBS-03 / Pitfall 4)
 * - Detecção de falhas terminais vs transitórias (D-08)
 *
 * Estados: idle → connecting → active → dead → rebuilding → active
 */
export class BonkRoom extends EventEmitter<BonkRoomEvents> {
  // Pitfall 4: TODO estado em propriedades de instância — nunca variável de módulo
  private transport: TransportLike | null = null;
  private _state: RoomState = createEmptyRoomState();
  private readonly desiredState: BonkRoomOptions['desiredState'];
  private readonly reconnectPolicy: ReconnectPolicy;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private roomStatus: 'idle' | 'connecting' | 'active' | 'dead' | 'rebuilding' = 'idle';
  private readonly logger: Logger;
  private readonly options: BonkRoomOptions;

  constructor(options: BonkRoomOptions) {
    super(); // EventEmitter3
    this.options = options;
    this.desiredState = options.desiredState;

    // Mesclar policy parcial com defaults (D-09)
    const partialPolicy = options.reconnectPolicy ?? {};
    const defaults = defaultReconnectPolicy();
    this.reconnectPolicy = {
      maxAttempts: partialPolicy.maxAttempts ?? defaults.maxAttempts,
      initialDelayMs: partialPolicy.initialDelayMs ?? defaults.initialDelayMs,
      maxDelayMs: partialPolicy.maxDelayMs ?? defaults.maxDelayMs,
      multiplier: partialPolicy.multiplier ?? defaults.multiplier,
      jitter: partialPolicy.jitter ?? defaults.jitter,
    };

    // Pitfall 4: logger criado por instância — nunca singleton de módulo
    this.logger = options.logger ?? pino({ name: 'bonk-room' });

    // Se transport foi injetado (modo teste), usá-lo diretamente
    if (options.transport) {
      this.transport = options.transport;
    }
  }

  /** Estado observado atual da sala (somente leitura via getter). */
  get state(): RoomState {
    return this._state;
  }

  /**
   * Conecta ao bonk.io (modo real — usa BonkTransportOptions).
   * Em modo teste, o transport já foi injetado no constructor.
   */
  async connect(): Promise<void> {
    if (this.options.transportOptions) {
      const transport = new BonkTransport(this.options.transportOptions);
      this.transport = transport as unknown as TransportLike;
    }
    if (!this.transport) {
      throw new Error('BonkRoom: nenhum transport disponível — forneça transportOptions ou transport injetado');
    }
    this.attachTransportListeners(this.transport);
    await this.transport.connect();
    this.roomStatus = 'connecting';
  }

  /**
   * Desconecta e limpa estado. Idempotente.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.roomStatus = 'idle';
    this.transport?.disconnect();
    this.transport = null;
    this._state = createEmptyRoomState();
  }

  // ─── Listeners do transport ────────────────────────────────────────────────

  private attachTransportListeners(transport: TransportLike): void {
    transport.on('disconnect', (reason: unknown) => {
      this.handleTransportDisconnect(String(reason ?? 'unknown'));
    });
    transport.on('packet', (raw: unknown) => {
      this.handleIncomingPacket(raw as [number, ...unknown[]]);
    });
  }

  /**
   * Handler de desconexão do transport (público para testes via acesso privado).
   * Transitório → agenda rebuild; terminado apenas após Pitfall 3 ser verificado.
   */
  private handleTransportDisconnect(reason: string): void {
    this.handleRoomDead({ kind: 'socket-disconnect', cause: reason });
  }

  // ─── Packet routing ────────────────────────────────────────────────────────

  /**
   * Processa packet incoming (público para testes via acesso privado).
   * D-06: emite 'raw-packet' ANTES de qualquer reducer.
   * D-11: decodeWithZod nunca lança — falhas viram UNKNOWN.
   */
  private handleIncomingPacket(raw: [number, ...unknown[]]): void {
    // 1. Decode com zod (defensivo — D-11 / Pitfall 2)
    const packet = decodeWithZod(raw, this.logger);

    // 2. Emitir raw-packet SEMPRE, antes de qualquer reducer (D-06)
    this.emit('raw-packet', packet as IncomingPacket | UnknownPacket);

    // 3. Routing por tipo de packet
    switch (packet.type) {
      case 'ROOM_JOIN':
        this._state = reduceRoomJoin(this._state, packet);
        this.roomStatus = 'active';
        this.reconnectAttempts = 0; // reset após reconexão bem-sucedida
        this.emit('room-join', packet);
        break;

      case 'PLAYER_JOIN':
        this._state = reducePlayerJoin(this._state, packet);
        this.emit('player-join', packet);
        break;

      case 'PLAYER_LEAVE':
        this._state = reducePlayerLeave(this._state, packet);
        this.emit('player-leave', packet);
        break;

      case 'TEAM_CHANGE':
        this._state = reduceTeamChange(this._state, packet);
        this.emit('team-change', packet);
        break;

      case 'READY_CHANGE':
        this._state = reduceReadyChange(this._state, packet);
        this.emit('ready-change', packet);
        break;

      case 'TABBED':
        this._state = reduceTabbedChange(this._state, { id: packet.id, tabbed: packet.tabbed });
        this.emit('tabbed', packet);
        break;

      case 'USERNAME_CHANGE':
        this._state = reduceUsernameChange(this._state, { id: packet.id, userName: packet.newName });
        this.emit('username-change', packet);
        break;

      case 'PLAYER_PINGS':
        this._state = reducePlayerPings(this._state, { pings: packet.pings });
        this.emit('player-pings', packet);
        // Resposta obrigatória ao ping do servidor (BonkBot pattern)
        this.transport?.sendPacket(1, { id: packet.pingId });
        break;

      case 'STATUS_MESSAGE':
        this.emit('status-message', packet);
        // Pitfall 3: verificar myId===null antes de tratar room_full como terminal
        // Se myId !== null, o bot já está na sala — room_full refere-se a outro jogador
        if (
          TERMINAL_STATUS_CODES.has(packet.status as StatusCode) &&
          this._state.myId === null
        ) {
          const kind = `status-${packet.status}` as RoomDeadReason['kind'];
          this.handleRoomDead({ kind });
        }
        break;

      case 'SHARE_LINK':
        this.emit('share-link', packet);
        // Emitir room-rebuilt com o novo link da sala
        {
          const url = `https://bonk.io/${packet.roomId}${packet.bypass}`;
          if (this.roomStatus === 'rebuilding' || this.roomStatus === 'connecting' || this.roomStatus === 'idle') {
            this.roomStatus = 'active';
            this.emit('room-rebuilt', url);
          }
        }
        break;

      case 'HOST_LEAVE':
        this.emit('host-leave', packet);
        // newHostId === -1 indica que a sala foi fechada pelo host
        if (packet.newHostId === -1) {
          this.handleRoomDead({ kind: 'socket-disconnect', cause: 'host-leave newHostId=-1' });
        }
        break;

      case 'ROOM_CREATED':
        this.emit('room-created', packet);
        break;

      case 'ALL_READY_RESET':
        this.emit('all-ready-reset', packet);
        break;

      case 'GAME_END':
        this.emit('game-end', packet);
        break;

      case 'GAME_START':
        this.emit('game-start', packet);
        break;

      case 'TEAMLOCK_TOGGLE':
        this.emit('teamlock-toggle', packet);
        break;

      case 'CHAT_MESSAGE':
        this.emit('chat-message', packet);
        break;

      case 'PLAYER_KICK':
        this.emit('player-kick', packet);
        break;

      case 'GAMEMODE_CHANGE':
        this.emit('gamemode-change', packet);
        break;

      case 'CHANGE_ROUNDS':
        this.emit('change-rounds', packet);
        break;

      case 'MAP_SWITCH':
        this.emit('map-switch', packet);
        break;

      case 'BALANCE_SET':
        this.emit('balance-set', packet);
        break;

      case 'COUNTDOWN':
        this.emit('countdown', packet);
        break;

      case 'ABORT_COUNTDOWN':
        this.emit('abort-countdown', packet);
        break;

      case 'PLAYER_LEVEL_UP':
        this.emit('player-level-up', packet);
        break;

      case 'ROOM_NAME_UPDATE':
        this.emit('room-name-update', packet);
        break;

      case 'ROOM_PASSWORD_UPDATE':
        this.emit('room-password-update', packet);
        break;

      case 'UNKNOWN':
        this.logger.debug({ raw: packet.raw }, 'unknown packet — emitting raw-packet only');
        break;

      // Packets com tipos conhecidos mas sem case explícito: emitidos apenas como raw-packet
      default:
        this.logger.debug({ type: (packet as { type: string }).type }, 'unhandled packet type');
        break;
    }
  }

  // ─── Morte e reconexão ────────────────────────────────────────────────────

  /**
   * Processa morte de sala (pública para testes via acesso privado).
   * Emite 'room-dead', limpa estado, decide se terminal ou transitório.
   */
  private handleRoomDead(reason: RoomDeadReason): void {
    this.roomStatus = 'dead';
    this._state = createEmptyRoomState();
    this.emit('room-dead', reason);

    const isTerminal =
      reason.kind === 'status-banned' ||
      reason.kind === 'status-room_full' ||
      reason.kind === 'max-retries-exceeded';

    if (isTerminal) {
      this.logger.warn({ reason }, 'room dead — terminal, sem retry');
      return;
    }

    // Transitório — tentar rebuild se ainda tiver tentativas
    this.scheduleRebuild();
  }

  /**
   * Agenda rebuild após backoff calculado.
   * Se não houver mais tentativas disponíveis, encerra silenciosamente
   * (room-dead já foi emitido pelo disconnect original).
   */
  private scheduleRebuild(): void {
    if (this.reconnectAttempts >= this.reconnectPolicy.maxAttempts) {
      // Exauriu tentativas — não emite segundo room-dead (room-dead já foi emitido)
      this.logger.warn(
        { attempts: this.reconnectAttempts, max: this.reconnectPolicy.maxAttempts },
        'max retry attempts reached — not retrying',
      );
      return;
    }

    const delay = computeBackoff(this.reconnectPolicy, this.reconnectAttempts);
    this.reconnectAttempts++;
    this.roomStatus = 'rebuilding';
    this.logger.info({ attempt: this.reconnectAttempts, delayMs: delay }, 'agendando rebuild');
    this.reconnectTimer = setTimeout(() => void this.rebuild(), delay);
  }

  /**
   * Executa o rebuild: desconecta transport antigo, cria novo, conecta.
   */
  private async rebuild(): Promise<void> {
    try {
      this.transport?.disconnect();
      this.transport = null;

      if (!this.options.transportOptions) {
        this.logger.warn('rebuild: transportOptions ausente — não é possível reconectar');
        return;
      }

      const transport = new BonkTransport(this.options.transportOptions);
      this.transport = transport as unknown as TransportLike;
      this.attachTransportListeners(this.transport);
      await this.transport.connect();
    } catch (err) {
      this.logger.error({ err }, 'rebuild falhou — agendando nova tentativa');
      this.scheduleRebuild();
    }
  }
}
