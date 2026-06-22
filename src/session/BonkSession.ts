// BonkSession.ts — pool de BonkRooms com AuthClient compartilhado, AccountThrottle e reconcile loop (RM-01, RM-04, RM-05, D-01..D-09).

import EventEmitter from 'eventemitter3'; // Pitfall 6: default import, não named
import pino from 'pino';
import type { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import { AuthClient } from '../auth/AuthClient.js';
import { createRoom } from '../room/factories.js';
import type { BonkRoom } from '../room/BonkRoom.js';
import type { RoomDeadReason } from '../room/types.js';
import { AccountThrottle } from './AccountThrottle.js';
import type {
  RoomStatus,
  RoomConfig,
  AccountThrottleOptions,
  BonkSessionOptions,
  BonkSessionEvents,
} from './types.js';
import type { AuthOptions } from '../auth/types.js';

// Defaults do token-bucket por conta (D-13): capacity 3, refill 0.5/s.
const DEFAULT_THROTTLE: AccountThrottleOptions = { capacity: 3, refillPerSec: 0.5 };

// Intervalo do reconcile loop híbrido (D-07): event-driven + varredura periódica.
const RECONCILE_INTERVAL_MS = 60_000;

/** Entrada do pool: a sala viva, seu status e a config declarativa que a originou. */
interface PoolEntry {
  room: BonkRoom;
  status: RoomStatus;
  config: RoomConfig;
}

/**
 * Classifica uma RoomDeadReason como terminal (não recriar) ou transitória (recriar com throttle).
 * Terminal: ban, sala cheia, retries esgotados (D-08).
 */
function isTerminalReason(reason: RoomDeadReason): boolean {
  return (
    reason.kind === 'status-banned' ||
    reason.kind === 'status-room_full' ||
    reason.kind === 'max-retries-exceeded'
  );
}

/**
 * BonkSession — camada central da Fase 5.
 *
 * Orquestra um pool de BonkRooms com um único AuthClient/token compartilhado
 * (conta única), um AccountThrottle por conta e um reconcile loop híbrido
 * (event-driven `room-dead` + varredura de 60s). `destroy()` é idempotente e
 * limpa todos os timers/handles (RM-04).
 *
 * Pitfall 4: todo estado em propriedades de instância — nunca variável de módulo.
 */
// @ts-ignore TS2507 — mesmo workaround de BonkRoom.ts: TS 5.9 + NodeNext DTS resolve
// eventemitter3 v5 default export como namespace ao processar via tsup antes do cache estar quente.
// Remover esta supressão ao atualizar tsup além de 8.5 ou TypeScript além de 5.7 e verificar se TS2507 sumiu.
export class BonkSession extends EventEmitter<BonkSessionEvents> {
  // declare explicita os métodos herdados — necessário pois @ts-ignore impede herança de tipos
  declare emit:               import('eventemitter3').EventEmitter<BonkSessionEvents>['emit'];
  declare on:                 import('eventemitter3').EventEmitter<BonkSessionEvents>['on'];
  declare once:               import('eventemitter3').EventEmitter<BonkSessionEvents>['once'];
  declare off:                import('eventemitter3').EventEmitter<BonkSessionEvents>['off'];
  declare removeAllListeners: import('eventemitter3').EventEmitter<BonkSessionEvents>['removeAllListeners'];

  private readonly auth: AuthOptions;
  private readonly authClient: AuthClient;
  private token: string | null = null;
  private readonly throttle: AccountThrottle;
  private readonly throttleOpts: AccountThrottleOptions;
  private readonly _rooms: Map<string, PoolEntry> = new Map();
  private readonly _desiredConfigs: RoomConfig[] = [];
  // WR-05: rastreia criações em andamento por config.id para evitar duplicatas no reconcile.
  private readonly _inFlight: Set<string> = new Set();
  private reconcileTimer: NodeJS.Timeout | null = null;
  private destroying = false;
  private readonly logger: Logger;

  constructor(opts: BonkSessionOptions) {
    super(); // EventEmitter3
    this.auth = opts.auth;
    this.authClient = new AuthClient(undefined, opts.logger);
    // Pitfall 4: logger criado por instância — nunca singleton de módulo.
    this.logger = opts.logger ?? pino({ name: 'bonk-session' });
    this.throttleOpts = opts.throttle ?? DEFAULT_THROTTLE;
    this.throttle = new AccountThrottle(this.throttleOpts);
  }

  /** Pool somente-leitura (cast readonly, sem copiar o Map). */
  get rooms(): ReadonlyMap<string, { room: BonkRoom; status: RoomStatus }> {
    return this._rooms as ReadonlyMap<string, { room: BonkRoom; status: RoomStatus }>;
  }

  /**
   * Pré-autentica a conta uma única vez, reusando o token em todas as salas.
   * NUNCA loga this.token (ASVS V3, V7).
   */
  async getToken(auth: AuthOptions = this.auth): Promise<void> {
    if (auth.type === 'registered' && this.token === null) {
      this.token = await this.authClient.getToken(auth.username, auth.password);
    }
  }

  /**
   * Cria uma sala e a adiciona ao pool com stagger via throttle.
   * Reusa o AuthClient e o token compartilhados (conta única). Retorna o localId.
   *
   * CR-03: não insere placeholder com null! — a entrada só entra no pool após
   * createRoom resolver com sucesso, eliminando o risco de null.room em acessos
   * concorrentes durante a janela de criação.
   */
  async addRoom(config: RoomConfig): Promise<string> {
    await this.throttle.acquire(this.logger);

    const localId = randomUUID();
    const room = await this.createRoomWithRetry(config);

    this._rooms.set(localId, { room, status: 'active', config });
    this.attachRoom(localId, room);
    this.logger.info({ roomName: config.name, shareLink: room.shareLink }, 'sala ativa');
    this.emit('room-added', localId);
    return localId;
  }

  /**
   * Chama createRoom com retry para erros transitórios de rede/servidor (HTTP 5xx,
   * ECONNREFUSED, ETIMEDOUT). Erros terminais (auth inválido, sala banida) propagam
   * imediatamente. Backoff exponencial: 3s → 6s → 12s → 24s → 30s (cap).
   */
  private async createRoomWithRetry(config: RoomConfig, maxAttempts = 5): Promise<BonkRoom> {
    const BASE_DELAY_MS = 3_000;
    const MAX_DELAY_MS = 30_000;

    for (let attempt = 1; ; attempt++) {
      try {
        return await createRoom({
          auth: this.auth,
          authClient: this.authClient,
          ...(this.token !== null ? { token: this.token } : {}),
          desiredState: {
            roomName: config.name,
            password: config.password ?? '',
            maxPlayers: config.maxPlayers ?? 6,
            mode: config.mode ?? 'b',
            rounds: config.rounds ?? 3,
            ...(config.map !== undefined ? { map: config.map } : {}),
          },
          ...(config.hidden !== undefined ? { hidden: config.hidden } : {}),
          logger: this.logger,
        });
      } catch (err) {
        const msg = (err as Error).message ?? '';
        const isTransient =
          /HTTP [5]\d{2}/.test(msg) ||
          /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET/.test(msg);

        if (!isTransient || attempt >= maxAttempts || this.destroying) {
          throw err;
        }

        const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        this.logger.warn(
          { attempt, maxAttempts, delayMs: delay, err: msg },
          'createRoom: erro transitório — aguardando antes de retentar',
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /** Desconecta e remove uma sala do pool. No-op se o id não existir. */
  async removeRoom(id: string): Promise<void> {
    const entry = this._rooms.get(id);
    if (!entry) {
      return;
    }
    this._rooms.delete(id);
    entry.room?.disconnect();
    this.emit('room-removed', id);
  }

  /**
   * Anexa o listener de `room-dead` à sala.
   * Terminal (D-08) → status 'dead-terminal', emite 'room-dead-terminal', para.
   * Transitória → status 'dead-transient' e agenda recreate throttled (D-07).
   */
  private attachRoom(localId: string, room: BonkRoom): void {
    room.on('room-dead', (reason: RoomDeadReason) => {
      const entry = this._rooms.get(localId);
      if (!entry) {
        return;
      }
      if (isTerminalReason(reason)) {
        entry.status = 'dead-terminal';
        // T-5-03-01: loga apenas { localId, reason } — nunca token/password/config.
        this.logger.warn({ localId, reason }, 'room dead-terminal — ação do operador necessária');
        this.emit('room-dead-terminal', { localId, reason });
        return;
      }
      entry.status = 'dead-transient';
      // T-5-03-02: scheduleRecreate só após room-dead definitivo. NÃO há retry de
      // erros transitórios de socket aqui — BonkRoom já reconecta internamente (R8).
      void this.scheduleRecreate(localId, entry.config);
    });
  }

  /**
   * Recria uma sala morta por causa transitória, respeitando o throttle por conta.
   * Remove a entrada antiga e cria uma nova (novo localId via addRoom).
   * WR-05: registra config.id em _inFlight para bloquear reconcile concorrente.
   */
  private async scheduleRecreate(localId: string, config: RoomConfig): Promise<void> {
    if (this.destroying) {
      return;
    }
    this._rooms.delete(localId);
    this._inFlight.add(config.id);
    try {
      await this.addRoom(config);
    } catch (err) {
      this.logger.warn({ localId, err: (err as Error).message }, 'scheduleRecreate falhou');
    } finally {
      this._inFlight.delete(config.id);
    }
  }

  /**
   * Inicia o timer de reconcile (D-07). `.unref()` para não manter o event loop vivo
   * após destroy() (T-5-03-03, anti-pattern R10).
   */
  private startReconcileTimer(): void {
    if (this.reconcileTimer) {
      return;
    }
    this.reconcileTimer = setInterval(() => {
      void this.reconcile();
    }, RECONCILE_INTERVAL_MS);
    this.reconcileTimer.unref?.();
  }

  /**
   * Diferença entre _desiredConfigs e o pool: recria as salas desejadas que não
   * têm entrada 'active' no pool nem estão em voo (_inFlight) — rede de segurança
   * para falhas silenciosas que não emitiram 'room-dead' (D-07).
   *
   * WR-05: checa _inFlight antes de disparar addRoom para evitar criações duplicadas
   * quando createRoom falhou e a entrada foi removida do pool antes do reconcile.
   */
  private reconcile(): void {
    if (this.destroying) {
      return;
    }
    const liveConfigIds = new Set<string>();
    for (const entry of this._rooms.values()) {
      if (entry.status === 'active' || entry.status === 'starting') {
        liveConfigIds.add(entry.config.id);
      }
    }
    for (const config of this._desiredConfigs) {
      if (!liveConfigIds.has(config.id) && !this._inFlight.has(config.id)) {
        this._inFlight.add(config.id);
        void this.addRoom(config).finally(() => this._inFlight.delete(config.id));
      }
    }
  }

  /**
   * Cria todas as salas declaradas com stagger + jitter entre criações (RM-05, D-09),
   * registra as configs desejadas para o reconcile loop e arma o timer de 60s.
   * O caller deve chamar getToken() antes para reusar o token entre as salas.
   *
   * WR-02: guard contra dupla invocação — lança se _desiredConfigs já foi populado.
   */
  async startFromConfig(config: {
    rooms: RoomConfig[];
    throttle: { maxConcurrentRooms: number; roomCreationDelayMs: number; roomCreationJitterMs: number };
  }): Promise<void> {
    if (this._desiredConfigs.length > 0) {
      throw new Error('BonkSession.startFromConfig: já foi iniciada — chame destroy() antes.');
    }
    this._desiredConfigs.push(...config.rooms);

    for (let i = 0; i < config.rooms.length; i++) {
      await this.addRoom(config.rooms[i]!);
      const isLast = i === config.rooms.length - 1;
      if (!isLast) {
        const delay =
          config.throttle.roomCreationDelayMs + Math.random() * config.throttle.roomCreationJitterMs;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }

    this.startReconcileTimer();
  }

  /**
   * Encerra a sessão (RM-04). Idempotente via guard `destroying`.
   * Limpa o reconcile timer, desconecta todas as salas, esvazia o pool e remove listeners.
   */
  async destroy(): Promise<void> {
    if (this.destroying) {
      return;
    }
    this.destroying = true;

    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }

    for (const entry of this._rooms.values()) {
      entry.room?.disconnect();
    }
    this._rooms.clear();
    this.removeAllListeners();
  }
}
