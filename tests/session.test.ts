// Wave 0 stubs — todos it.todo() aguardando implementação em planos 05-02 e 05-03.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const SILENT_LOGGER = pino({ level: 'silent' });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('BonkSession — pool de salas (RM-01)', () => {
  it.todo('addRoom cria sala no pool e retorna localId único');
  it.todo('removeRoom remove sala do pool e chama disconnect');
  it.todo('getter rooms reflete estado atual do pool como ReadonlyMap');
});

describe('BonkSession — reconcile loop (RM-01, D-07, D-08)', () => {
  it.todo('room-dead terminal → status dead-terminal, sem recriar (D-08)');
  it.todo('room-dead não-terminal → scheduleRecreate com throttle');
  it.todo('timer de 60s detecta sala em estado inconsistente não emitida (D-07)');
});

describe('BonkSession — destroy (RM-04)', () => {
  it.todo('destroy() chama disconnect em todas as rooms do pool');
  it.todo('destroy() limpa o reconcile timer (sem handle leak)');
  it.todo('destroy() idempotente — segunda chamada não lança');
});

describe('BonkSession — kick por nome (RM-03, D-06)', () => {
  it.todo('kick-by-name resolve nome para id via room.state.players');
  it.todo('kick-by-name retorna false quando jogador não encontrado');
});

describe('BonkSession — stagger/jitter (RM-05, D-09)', () => {
  it.todo('startFromConfig aguarda delay+jitter entre criações de sala');
});
