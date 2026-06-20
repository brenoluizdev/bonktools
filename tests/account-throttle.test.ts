// account-throttle.test.ts — testes do token bucket (RM-05).
// Offline com fake timers + vi.setSystemTime para controlar Date.now().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AccountThrottle } from '../src/session/AccountThrottle.js';
import pino from 'pino';

const SILENT_LOGGER = pino({ level: 'silent' });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AccountThrottle — token bucket (RM-05)', () => {
  it('tokens começam com capacidade máxima e diminuem a cada acquire', async () => {
    const throttle = new AccountThrottle({ capacity: 5, refillPerSec: 1 });
    // 5 tokens disponíveis: 5 acquires consecutivos resolvem sem avançar o tempo.
    for (let i = 0; i < 5; i++) {
      await throttle.acquire();
    }
    expect(throttle['tokens']).toBeLessThan(1);
  });

  it('refill acumula tokens corretos após tempo decorrido (Date.now fake)', async () => {
    vi.setSystemTime(0);
    const throttle = new AccountThrottle({ capacity: 5, refillPerSec: 1 });
    // Esgota todos os tokens.
    for (let i = 0; i < 5; i++) {
      await throttle.acquire();
    }
    expect(throttle['tokens']).toBeLessThan(1);
    // Avança 3s → +3 tokens (refillPerSec=1).
    vi.setSystemTime(3000);
    await throttle.acquire(); // refill → ~3 tokens, consome 1 → ~2.
    expect(throttle['tokens']).toBeGreaterThanOrEqual(1.9);
    expect(throttle['tokens']).toBeLessThanOrEqual(2.1);
  });

  it('acquire() resolve imediatamente quando tokens disponíveis', async () => {
    const throttle = new AccountThrottle({ capacity: 5, refillPerSec: 1 });
    let resolved = false;
    const p = throttle.acquire().then(() => {
      resolved = true;
    });
    await p;
    expect(resolved).toBe(true);
  });

  it('acquire() aguarda e resolve quando tokens se esgotam', async () => {
    vi.setSystemTime(0);
    const throttle = new AccountThrottle({ capacity: 1, refillPerSec: 1 });
    await throttle.acquire(); // consome o único token.
    let resolved = false;
    const p = throttle.acquire().then(() => {
      resolved = true;
    });
    // Sem avançar o tempo, ainda não resolveu.
    expect(resolved).toBe(false);
    await vi.runAllTimersAsync();
    await p;
    expect(resolved).toBe(true);
  });

  it('acquire() loga waitMs via logger quando forçado a esperar', async () => {
    vi.setSystemTime(0);
    const infoSpy = vi.spyOn(SILENT_LOGGER, 'info');
    const throttle = new AccountThrottle({ capacity: 1, refillPerSec: 1 });
    await throttle.acquire(); // consome o token, sem espera → sem log.
    expect(infoSpy).not.toHaveBeenCalled();
    const p = throttle.acquire(SILENT_LOGGER);
    await vi.runAllTimersAsync();
    await p;
    expect(infoSpy).toHaveBeenCalled();
    const [meta] = infoSpy.mock.calls[0] as [{ waitMs: number; tokens: number }, string];
    expect(meta.waitMs).toBeGreaterThan(0);
  });

  it('tokens não ultrapassam capacity no refill', async () => {
    vi.setSystemTime(0);
    const throttle = new AccountThrottle({ capacity: 5, refillPerSec: 1 });
    await throttle.acquire(); // tokens ~4.
    // Avança um tempo enorme → refill tentaria adicionar muitos tokens.
    vi.setSystemTime(1_000_000);
    await throttle.acquire(); // refill cap em 5, consome 1 → 4.
    expect(throttle['tokens']).toBeLessThanOrEqual(5);
    expect(throttle['tokens']).toBeGreaterThanOrEqual(3.9);
    expect(throttle['tokens']).toBeLessThanOrEqual(4.1);
  });
});
