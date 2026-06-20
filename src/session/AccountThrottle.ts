// AccountThrottle.ts — token bucket para throttle de operações no nível de conta (RM-05, D-03).
// Rate limits do bonk.io são por conta, não por socket: um único throttle por BonkSession
// gata createRoom e moderação em massa. On-demand (sem timer de background): refill é lazy,
// calculado a partir do tempo decorrido a cada acquire().

import type { Logger } from 'pino';
import type { AccountThrottleOptions } from './types.js';

export class AccountThrottle {
  private tokens: number;
  private last: number = Date.now();

  constructor(private readonly opts: AccountThrottleOptions) {
    this.tokens = opts.capacity;
  }

  /**
   * Reabastece o bucket com base no tempo decorrido desde o último refill.
   * tokens += elapsedSec * refillPerSec, com cap em capacity.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.tokens = Math.min(this.opts.capacity, this.tokens + elapsed * this.opts.refillPerSec);
    this.last = now;
  }

  /**
   * Adquire um token. Resolve imediatamente quando há tokens disponíveis;
   * caso contrário aguarda o tempo necessário para acumular 1 token e tenta de novo.
   * Quando forçado a esperar e um logger é fornecido, loga waitMs e tokens atuais
   * (descoberta de teto de rate — NOTE C6).
   */
  async acquire(logger?: Logger): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.opts.refillPerSec) * 1000;
    logger?.info({ waitMs, tokens: this.tokens }, 'account-throttle: queued (possible rate ceiling)');
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    return this.acquire(logger);
  }
}
