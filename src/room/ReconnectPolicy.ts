// ReconnectPolicy.ts — política de reconexão com backoff exponencial + jitter.
// Fase 2: isolado como módulo puro para testabilidade independente de rede.
// Parâmetros baseados nas decisões do planner (Claude's Discretion — RESEARCH.md Pattern 4).

/**
 * Política de reconexão do BonkRoom.
 * Todos os campos obrigatórios — defaults aplicados via defaultReconnectPolicy().
 */
export interface ReconnectPolicy {
  /** Número máximo de tentativas antes de declarar max-retries-exceeded. Default: 10 */
  maxAttempts: number;
  /** Delay inicial em ms. Default: 1000 (1s) */
  initialDelayMs: number;
  /** Delay máximo em ms (cap). Default: 30000 (30s) */
  maxDelayMs: number;
  /** Multiplicador exponencial. Default: 1.5 */
  multiplier: number;
  /** Se true, aplica full jitter (uniforme entre 0 e capped). Default: true */
  jitter: boolean;
}

/**
 * Opções de configuração da política — todos os campos opcionais.
 * Campos ausentes recebem os defaults de defaultReconnectPolicy().
 */
export interface ReconnectPolicyOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitter?: boolean;
}

/**
 * Retorna a política de reconexão com os defaults recomendados.
 * Usar em BonkRoom quando nenhuma policy for passada nas opções.
 */
export function defaultReconnectPolicy(): ReconnectPolicy {
  return {
    maxAttempts: 10,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 1.5,
    jitter: true,
  };
}

/**
 * Calcula o delay de backoff para uma tentativa específica.
 *
 * Fórmula:
 *   base = initialDelayMs * multiplier^attempt
 *   capped = min(maxDelayMs, base)
 *   sem jitter: return capped
 *   com jitter (full jitter): return floor(random() * capped)
 *
 * Exemplo (defaults, sem jitter):
 *   attempt=0 → 1000ms
 *   attempt=1 → 1500ms
 *   attempt=5 → 7594ms
 *   attempt=9 → 30000ms (capped)
 *
 * @param policy Política de reconexão.
 * @param attempt Índice da tentativa (0-based).
 */
export function computeBackoff(policy: ReconnectPolicy, attempt: number): number {
  const base = policy.initialDelayMs * Math.pow(policy.multiplier, attempt);
  const capped = Math.min(policy.maxDelayMs, base);
  if (!policy.jitter) return capped;
  // Full jitter: uniforme entre [0, capped]
  return Math.floor(Math.random() * capped);
}
