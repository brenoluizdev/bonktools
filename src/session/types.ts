// types.ts — contratos de interface do módulo session/.
// Fase 5: RoomStatus, RoomConfig, AccountThrottleOptions, BonkSessionOptions, BonkSessionEvents.
// Padrão: interfaces TypeScript puras (sem zod), importáveis com `import type`.
// Análogo a room/types.ts — mesmo papel para o módulo session/.

import type { Logger } from 'pino';
import type { AuthOptions } from '../auth/types.js';
import type { RoomDeadReason } from '../room/types.js';

// ─── RoomStatus ────────────────────────────────────────────────────────────────

/**
 * Status de ciclo de vida de uma sala dentro do pool da BonkSession (D-08).
 *
 * - starting: criação em andamento (createRoom não resolveu ainda).
 * - active: sala criada e ativa.
 * - dead-transient: morta por causa transitória — elegível a recreate com throttle.
 * - dead-terminal: morta por causa terminal (ban, room-full, max-retries) — não recriar.
 */
export type RoomStatus = 'starting' | 'active' | 'dead-transient' | 'dead-terminal';

// ─── RoomConfig ────────────────────────────────────────────────────────────────

/**
 * Configuração declarativa de uma sala lida do arquivo de config (D-13 / RM-05).
 * Campos opcionais recebem defaults na camada de validação (config.ts do app).
 */
export interface RoomConfig {
  id: string;
  name: string;
  password?: string;
  maxPlayers?: number;
  mode?: string;
  rounds?: number;
  hidden?: boolean;
  map?: string;
}

// ─── AccountThrottleOptions ──────────────────────────────────────────────────────

/**
 * Opções do token-bucket por conta (RM-05 / D-09).
 * Campos obrigatórios — defaults aplicados via factory na camada que constrói a opção.
 */
export interface AccountThrottleOptions {
  capacity: number;
  refillPerSec: number;
}

// ─── BonkSessionOptions ──────────────────────────────────────────────────────────

/**
 * Opções de construção da BonkSession.
 *
 * - auth: estratégia de autenticação compartilhada por todas as salas (conta única).
 * - throttle: opções do token-bucket (default aplicado quando ausente).
 * - logger: logger pino por instância (Pitfall 4 — nunca singleton de módulo).
 */
export interface BonkSessionOptions {
  auth: AuthOptions;
  throttle?: AccountThrottleOptions;
  logger?: Logger;
}

// ─── BonkSessionEvents ───────────────────────────────────────────────────────────

/**
 * Mapa de eventos tipados da BonkSession.
 * Consumido como generic: `class BonkSession extends EventEmitter<BonkSessionEvents>`.
 *
 * - room-added: sala criada e adicionada ao pool (localId único).
 * - room-removed: sala removida do pool (localId).
 * - room-dead-terminal: sala morta por causa terminal — não será recriada (D-08).
 */
export interface BonkSessionEvents {
  'room-added':         [localId: string];
  'room-removed':       [localId: string];
  'room-dead-terminal': [payload: { localId: string; reason: RoomDeadReason }];
}
