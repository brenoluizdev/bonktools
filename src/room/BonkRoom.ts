// BonkRoom.ts — classe principal da Fase 2.
// Envolve BonkTransport (detalhe de implementação), expõe EventEmitter3<BonkRoomEvents>.
// Implementa roster routing via reducers puros + máquina de estados de reconexão.
// D-01: BonkRoom é a interface pública; BonkTransport vira detalhe interno.

import EventEmitter from 'eventemitter3'; // Pitfall 6: default import, não named
import pino from 'pino';
import type { Logger } from 'pino';
import { BonkTransport } from '../transport/BonkTransport.js';
import { decodeWithZod } from '../codec/decode.js';
import { TERMINAL_STATUS_CODES, OUTGOING_PACKET_IDS } from '../codec/packets.js';
import type { StartGameOptions } from '../codec/packets.js';
import { encodeStartGame } from '../codec/encode.js';
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
  reduceGameStart,
  reduceGameEnd,
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
// @ts-ignore TS2507 — mesmo workaround de BonkTransport.ts: TS 5.9 + NodeNext DTS resolve
// eventemitter3 v5 default export como namespace ao processar via tsup antes do cache estar quente.
export class BonkRoom extends EventEmitter<BonkRoomEvents> {
  // declare explicita os métodos herdados — necessário pois @ts-ignore impede herança de tipos
  declare emit:              import('eventemitter3').EventEmitter<BonkRoomEvents>['emit'];
  declare on:                import('eventemitter3').EventEmitter<BonkRoomEvents>['on'];
  declare once:              import('eventemitter3').EventEmitter<BonkRoomEvents>['once'];
  declare off:               import('eventemitter3').EventEmitter<BonkRoomEvents>['off'];
  declare removeAllListeners: import('eventemitter3').EventEmitter<BonkRoomEvents>['removeAllListeners'];

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
  private _shareLink: string | null = null;

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

  /** Share link da sala (formato bonk.io/<roomId><bypass>). Null antes do packet 49. */
  get shareLink(): string | null {
    return this._shareLink;
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

  /**
   * Envia packet outgoing para o servidor bonk.io.
   * Usado pelas factories createRoom/joinRoom e métodos de game flow (Phase 4).
   */
  sendPacket(eventId: number, data: unknown): void {
    if (!this.transport) {
      throw new Error('BonkRoom.sendPacket: transport não conectado');
    }
    this.transport.sendPacket(eventId, data);
  }

  /**
   * Aguarda um evento específico do EventEmitter3 com timeout.
   * Usado internamente pelas factories para aguardar confirmação assíncrona.
   * Rejeita com timeoutError se o evento não chegar dentro de timeoutMs.
   */
  protected _waitForEvent<K extends keyof BonkRoomEvents>(
    event: K,
    timeoutMs: number,
    timeoutError: Error,
  ): Promise<BonkRoomEvents[K][0]> {
    return new Promise<BonkRoomEvents[K][0]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        timer = null;
        this.off(event, handler as Parameters<typeof this.off>[1]);
        reject(timeoutError);
      }, timeoutMs);
      const handler = (arg: BonkRoomEvents[K][0]): void => {
        if (timer !== null) { clearTimeout(timer); timer = null; }
        resolve(arg);
      };
      this.once(event, handler as Parameters<typeof this.once>[1]);
    });
  }

  /** Muda o nome da sala em runtime. Fire-and-forget (D-09 Fase 3). */
  setRoomName(name: string): void {
    this.desiredState.roomName = name;
    if (!this.transport) {
      this.logger.warn({ name }, 'setRoomName: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SET_ROOM_NAME, { newName: name });
  }

  /** Muda a senha da sala em runtime. Fire-and-forget (D-10 Fase 3). */
  setRoomPassword(password: string): void {
    this.desiredState.password = password;
    if (!this.transport) {
      this.logger.warn('setRoomPassword: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SET_ROOM_PASSWORD, { newPass: password });
  }

  // ─── Phase 4 — Game Flow ──────────────────────────────────────────────────

  /** Inicia a partida (packet 5). Spike confirmou: is='' aceito pelo servidor. */
  startGame(opts?: StartGameOptions): void {
    if (!this.transport) {
      this.logger.warn({ opts }, 'startGame: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.TRIGGER_START, encodeStartGame(this.desiredState, opts));
  }

  /** Retorna todos ao lobby (packet 14). */
  stopGame(): void {
    if (!this.transport) {
      this.logger.warn('stopGame: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.RETURN_TO_LOBBY, undefined);
  }

  /** Inicia countdown (packet 36). Default: 3 segundos. */
  startCountdown(num?: number): void {
    if (!this.transport) {
      this.logger.warn({ num }, 'startCountdown: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_START_COUNTDOWN, { num: num ?? 3 });
  }

  /** Cancela countdown em andamento (packet 37). */
  abortCountdown(): void {
    if (!this.transport) {
      this.logger.warn('abortCountdown: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_ABORT_COUNTDOWN, undefined);
  }

  // ─── Phase 4 — Configuração de Partida (D-10) ────────────────────────────

  /**
   * Muda o modo de jogo. Atualiza desiredState antes do transport guard (D-10).
   *
   * **Contrato de desconexão:** se o transport estiver desconectado no momento da
   * chamada, a mudança é aplicada apenas ao desiredState local — o packet é
   * descartado silenciosamente. A configuração só será reenviada ao servidor na
   * próxima chamada a `startGame()`, que re-aplica o desiredState completo.
   */
  setMode(engine: string, mode: string): void {
    this.desiredState.engine = engine;
    this.desiredState.mode = mode;
    if (!this.transport) {
      this.logger.warn({ engine, mode }, 'setMode: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_MODE, { ga: engine, mo: mode });
  }

  /**
   * Define o número de rounds. Atualiza desiredState antes do transport guard (D-10).
   *
   * **Contrato de desconexão:** se o transport estiver desconectado no momento da
   * chamada, a mudança é aplicada apenas ao desiredState local — o packet é
   * descartado silenciosamente. A configuração só será reenviada ao servidor na
   * próxima chamada a `startGame()`, que re-aplica o desiredState completo.
   */
  setRounds(n: number): void {
    this.desiredState.rounds = n;
    if (!this.transport) {
      this.logger.warn({ rounds: n }, 'setRounds: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_ROUNDS, { w: n });
  }

  /**
   * Substitui o mapa ativo. Sequência: SEND_MAP_DELETE (22) + SEND_MAP_ADD (23). Atualiza desiredState (D-10).
   *
   * **Contrato de desconexão:** se o transport estiver desconectado no momento da
   * chamada, a mudança é aplicada apenas ao desiredState local — os packets são
   * descartados silenciosamente. A configuração só será reenviada ao servidor na
   * próxima chamada a `startGame()`, que re-aplica o desiredState completo.
   */
  setMap(mapData: string): void {
    this.desiredState.map = mapData;
    if (!this.transport) {
      this.logger.warn({ mapLen: mapData.length }, 'setMap: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_MAP_DELETE, { d: 0 });
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_MAP_ADD, { m: mapData });
  }

  // ─── Phase 4 — Moderação ─────────────────────────────────────────────────

  /** Envia mensagem de chat (packet 10). Fire-and-forget. */
  chat(message: string): void {
    if (!this.transport) {
      this.logger.warn({}, 'chat: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.CHAT_MESSAGE, { message });
  }

  /** Kick de jogador sem ban (packet 9 com kickonly: true). */
  kickPlayer(id: number): void {
    if (!this.transport) {
      this.logger.warn({ id }, 'kickPlayer: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.KICK_BAN_PLAYER, { banshortid: id, kickonly: true as const });
  }

  /** Ban de jogador (packet 9). CRÍTICO: omitir campo kickonly — não passar kickonly: false. */
  banPlayer(id: number): void {
    if (!this.transport) {
      this.logger.warn({ id }, 'banPlayer: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.KICK_BAN_PLAYER, { banshortid: id });
  }

  // ─── Phase 4 — Times e Host ───────────────────────────────────────────────

  /** Move jogador para um time (packet 26). team: 0=spec 1=ffa 2=red 3=blue 4=green 5=yellow. */
  setTeam(id: number, team: number): void {
    if (!this.transport) {
      this.logger.warn({ id, team }, 'setTeam: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.CHANGE_OTHER_TEAM_OTHER, { targetID: id, targetTeam: team });
  }

  /** Bloqueia ou desbloqueia times (packet 7). */
  setTeamLock(locked: boolean): void {
    if (!this.transport) {
      this.logger.warn({ locked }, 'setTeamLock: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.TEAM_LOCK, { teamLock: locked });
  }

  /** Habilita ou desabilita times (packet 32). */
  setTeamsEnabled(enabled: boolean): void {
    if (!this.transport) {
      this.logger.warn({ enabled }, 'setTeamsEnabled: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_TEAM_SETTINGS, { t: enabled });
  }

  /** Transfere host para outro jogador (packet 34). */
  giveHost(id: number): void {
    if (!this.transport) {
      this.logger.warn({ id }, 'giveHost: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_HOST_CHANGE, { id });
  }

  /**
   * Desabilita troca automática de host (packet 50).
   * setNoHostSwap(false): sem packet de desativação no protocolo bonk.io — loga warn e ignora.
   */
  setNoHostSwap(enabled: boolean): void {
    if (!enabled) {
      this.logger.warn({ enabled }, 'setNoHostSwap(false): sem packet de desativação no protocolo bonk.io — chamada ignorada');
      return;
    }
    if (!this.transport) {
      this.logger.warn({}, 'setNoHostSwap: transport não conectado — packet descartado');
      return;
    }
    this.transport.sendPacket(OUTGOING_PACKET_IDS.SEND_NO_HOST_SWAP, undefined);
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
        // CR-02: 'banned' é sempre terminal; 'room_full' só é terminal quando myId===null
        // (Pitfall 3: room_full refere-se a outro jogador quando bot já está na sala)
        if (packet.status === 'banned') {
          this.handleRoomDead({ kind: 'status-banned' });
        } else if (packet.status === 'room_full' && this._state.myId === null) {
          this.handleRoomDead({ kind: 'status-room_full' });
        }
        break;

      case 'SHARE_LINK': {
        const url = `https://bonk.io/${packet.roomId}${packet.bypass}`;
        this._shareLink = url; // persistir ANTES de emitir — getter disponível em handlers
        this.emit('share-link', packet);
        // Emitir room-rebuilt com o novo link da sala
        if (this.roomStatus === 'rebuilding' || this.roomStatus === 'connecting' || this.roomStatus === 'idle') {
          this.roomStatus = 'active';
          this.emit('room-rebuilt', url);
        }
        break;
      }

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
        this._state = reduceGameEnd(this._state);
        this.emit('game-end', packet);
        break;

      case 'GAME_START':
        this._state = reduceGameStart(this._state);
        this.emit('game-start', packet);
        break;

      case 'TEAMLOCK_TOGGLE':
        this.emit('teamlock-toggle', packet);
        break;

      case 'CHAT_MESSAGE':
        // D-07: echo filter — null === number é sempre false (seguro antes do join)
        if (packet.id === this._state.myId) break;
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
      this.logger.warn(
        { attempts: this.reconnectAttempts, max: this.reconnectPolicy.maxAttempts },
        'max retry attempts reached — not retrying',
      );
      // Emitir max-retries-exceeded apenas quando já houve ao menos uma tentativa,
      // para distinguir de maxAttempts:0 (sem retry) onde room-dead já foi emitido.
      if (this.reconnectAttempts > 0) {
        this.emit('room-dead', {
          kind: 'max-retries-exceeded',
          attempts: this.reconnectAttempts,
        });
      }
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
