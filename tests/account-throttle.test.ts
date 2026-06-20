// Wave 0 stubs — todos it.todo() aguardando implementação em planos 05-02 e 05-03.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AccountThrottle — token bucket (RM-05)', () => {
  it.todo('tokens começam com capacidade máxima e diminuem a cada acquire');
  it.todo('refill acumula tokens corretos após tempo decorrido (Date.now fake)');
  it.todo('acquire() resolve imediatamente quando tokens disponíveis');
  it.todo('acquire() aguarda e resolve quando tokens se esgotam');
  it.todo('acquire() loga waitMs via logger quando forçado a esperar');
  it.todo('tokens não ultrapassam capacity no refill');
});
