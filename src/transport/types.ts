// Interfaces específicas do transport layer — Phase 1 (D-04: TypeScript puro, sem zod).
// Reaproveita AuthOptions/ServerInfo de auth/types.ts — não duplica campos já definidos lá.

import type { Logger } from 'pino';
import type { AuthOptions, ServerInfo } from '../auth/types.js';

// Re-export para consumers do transport não precisarem importar de auth/ diretamente.
export type { AuthOptions, ServerInfo } from '../auth/types.js';

/**
 * Abordagem TLS em uso na conexão WebSocket (D-01/D-02).
 * - `ca`: tls.rootCertificates + rejectUnauthorized:true (tentativa preferida — KI-01: GTS)
 * - `reject-unauthorized-false`: fallback escopado ao socket — NUNCA global (D-01)
 */
export type TlsMode = 'ca' | 'reject-unauthorized-false';

/**
 * Estado da conexão do BonkTransport.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting';

/**
 * Opções de construção do BonkTransport.
 * `protocolVersion` é opcional com default 49 aplicado dentro da classe — Pitfall 4:
 * NÃO hardcodar a versão do protocolo; valores não-default emitem warning via pino.
 */
export interface BonkTransportOptions {
  server: ServerInfo;
  auth: AuthOptions;
  protocolVersion?: number;
  logger?: Logger;
  /**
   * @deprecated KI-01: bonk.io migrou para Google Trust Services (2026).
   * tls.rootCertificates cobre GTS — PEM Sectigo não é mais necessário.
   * Este campo é ignorado desde Phase 2. Será removido em Phase 3.
   */
  certPath?: string;
}
