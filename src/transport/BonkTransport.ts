// BonkTransport — classe principal do Phase 1.
// Integra socket.io-client@2 (EIO=3, CONN-01), TLS workaround (D-01/D-02, CONN-05),
// heartbeat timesync + anti-idle (CONN-04) e cleanup graceful (CONN-06).
// Padrões mapeados em 01-RESEARCH.md (Pattern 1/3/4, Q8). Referência: BonkBot/src/bot.js.

import EventEmitter from 'eventemitter3';
import io from 'socket.io-client';
import pino from 'pino';
import type { Logger } from 'pino';
import { encodeTimesync } from '../codec/encode.js';
import { decode } from '../codec/decode.js';
import { INCOMING_PACKET_IDS } from '../codec/packets.js';
import type { BonkTransportOptions, ConnectionState, BonkTransportEvents } from './types.js';
import type { EventEmitter as EE3 } from 'eventemitter3';

// O shim socket-shim.d.ts usa `export = io` — o tipo Socket (interface interna) não é
// exportado nomeadamente. Derivamos o tipo da conexão do retorno de io().
type Socket = ReturnType<typeof io>;

const DEFAULT_PROTOCOL_VERSION = 49;
const ANTI_IDLE_INTERVAL_MS = 29 * 60 * 1000;
const ANTI_IDLE_TOGGLE_DELAY_MS = 500;
const CHANGE_OWN_TEAM_PACKET = 6; // teams: 0=spec, 1=ffa, 2=red, 3=blue, 4=green, 5=yellow

// KI-01: bonk.io migrou para Google Trust Services (2026). tls.rootCertificates cobre GTS.
// PEM Sectigo (bonk_fullchain.pem) removido da Abordagem 1 — mantém apenas tls.rootCertificates.

// TS2507 workaround: TypeScript 5.9+ NodeNext DTS builder resolve o import default de eventemitter3
// como typeof namespace ao processar este arquivo antes de BonkRoom.ts. O ignore suprime o falso
// positivo sem afetar a herança em runtime — BonkRoom.ts usa o mesmo padrão sem erro.
// @ts-ignore TS2507
export class BonkTransport extends EventEmitter<BonkTransportEvents> {
  // declare explicita os métodos herdados — necessário pois @ts-ignore impede herança de tipos
  declare emit: EE3<BonkTransportEvents>['emit'];
  declare on:   EE3<BonkTransportEvents>['on'];
  declare off:  EE3<BonkTransportEvents>['off'];

  private socket: Socket | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private antiIdleTimer: NodeJS.Timeout | null = null;
  private timesyncCount = 0;
  private state: ConnectionState = 'disconnected';
  private readonly logger: Logger;
  private readonly opts: BonkTransportOptions | null;

  /**
   * Modo real: recebe BonkTransportOptions e usa connect() para abrir o socket.
   * Modo teste/injeção: recebe um Socket já existente (ou mock) — usado pelos unit
   * tests da Wave 0, que injetam um socket mock e exercitam startTimesync/disconnect
   * sem rede.
   */
  constructor(optsOrSocket: BonkTransportOptions | Socket) {
    super();
    if (this.isTransportOptions(optsOrSocket)) {
      this.opts = optsOrSocket;
      this.logger = optsOrSocket.logger ?? pino({ name: 'bonk-transport' });

      // Pitfall 4: protocolVersion não-default exige confirmação de compatibilidade.
      const pv = optsOrSocket.protocolVersion;
      if (pv !== undefined && pv !== DEFAULT_PROTOCOL_VERSION) {
        this.logger.warn(
          { protocolVersion: pv },
          'non-default protocol version — ensure bonk.io compatibility',
        );
      }
    } else {
      // Socket injetado (testes): nenhuma opção de conexão, socket já pronto.
      this.opts = null;
      this.socket = optsOrSocket;
      this.state = 'connected';
      this.logger = pino({ name: 'bonk-transport', level: 'silent' });
    }
  }

  private isTransportOptions(value: BonkTransportOptions | Socket): value is BonkTransportOptions {
    return 'server' in value && 'auth' in value;
  }

  /** Estado atual da conexão. */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Conecta ao bonk.io via socket.io-client@2 com transports: ['websocket'] (EIO=3, CONN-01).
   *
   * TLS: bonk.io não envia a cadeia intermediária completa (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
   * então rejectUnauthorized:false é necessário e escopado a este socket (D-01).
   * forceNode:true força engine.io-client@3 a usar ws@7 em vez do WebSocket global nativo
   * do Node.js 22 (que ignora todas as opções TLS do Node).
   */
  async connect(): Promise<void> {
    if (!this.opts) {
      throw new Error('connect() requires BonkTransportOptions — use the options constructor');
    }
    this.state = 'connecting';

    const url = `https://${this.opts.server.server}.bonk.io`;

    await new Promise<void>((resolve, reject) => {
      const socket = io(url, {
        transports: ['websocket'] as string[],
        reconnection: false,
        timeout: 10000,
        forceNew: true,
        path: '/socket.io',
        forceNode: true,
        rejectUnauthorized: false,
      });

      socket.on('connect', () => {
        this.socket = socket;
        this.state = 'connected';
        this.startTimesync();
        this.startAntiIdle();
        // Pitfall 6: listeners de resposta usam ID numérico, não string.
        socket.on(INCOMING_PACKET_IDS.TIMESYNC as unknown as string, (...args: unknown[]) => {
          decode([INCOMING_PACKET_IDS.TIMESYNC, ...args]);
        });
        // Pitfall 7: nenhum packet é emitido antes deste evento 'connect'.
        resolve();
        socket.on('disconnect', (reason: unknown) => {
          this.emit('disconnect', String(reason ?? 'unknown'));
        });
        for (const [, id] of Object.entries(INCOMING_PACKET_IDS)) {
          if (id === INCOMING_PACKET_IDS.TIMESYNC) continue;
          socket.on(id as unknown as string, (...args: unknown[]) => {
            this.emit('packet', [id, ...args]);
          });
        }
      });

      socket.on('connect_error', (...args: unknown[]) => {
        const message = String((args[0] as Error)?.message ?? args[0] ?? '');
        this.state = 'disconnected';
        socket.disconnect();
        reject(new Error(`bonk.io connect_error: ${message}`));
      });
    });
  }

  /**
   * Inicia o heartbeat de timesync (packet 18 a cada 5s) — Pattern 3 / CONN-04.
   * Público para permitir injeção de socket nos unit tests.
   */
  startTimesync(): void {
    this.keepAliveTimer = setInterval(() => {
      if (this.socket?.connected) {
        const [eventId, payload] = encodeTimesync(this.timesyncCount++);
        this.socket.emit(eventId, payload);
      }
    }, 5000); // timesync a cada 5s (CONN-04)
  }

  /**
   * Inicia o anti-idle de sala (packet 6 red→spec a cada ~29 min) — Pattern 4 / CONN-04.
   * Phase 1 sempre emite se conectado; Phase 2 checará o roster antes (T-1-03 accept).
   */
  startAntiIdle(): void {
    this.antiIdleTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit(CHANGE_OWN_TEAM_PACKET, { targetTeam: 2 }); // → red
        setTimeout(() => {
          if (this.socket?.connected) {
            this.socket.emit(CHANGE_OWN_TEAM_PACKET, { targetTeam: 0 }); // → spec
          }
        }, ANTI_IDLE_TOGGLE_DELAY_MS);
      }
    }, ANTI_IDLE_INTERVAL_MS);
  }

  /**
   * Envia um packet arbitrário ao servidor. T-1-T2: só emite se conectado.
   */
  sendPacket(eventId: number, data: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(eventId, data);
    }
  }

  /**
   * Disconnect graceful (CONN-06 / Q8): limpa timers, fecha o socket e libera referência.
   * Idempotente — seguro chamar mais de uma vez.
   */
  disconnect(): void {
    this.state = 'disconnecting';

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (this.antiIdleTimer) {
      clearInterval(this.antiIdleTimer);
      this.antiIdleTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.state = 'disconnected';
  }
}
