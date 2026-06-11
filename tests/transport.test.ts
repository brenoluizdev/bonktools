import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Wave 0 scaffold — este import FALHA até o plano 04 criar BonkTransport.
// Esperado e correto (Nyquist: red antes da implementação).
import { BonkTransport } from '../src/transport/BonkTransport.js';

interface MockSocket {
  connected: boolean;
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeMockSocket(): MockSocket {
  return {
    connected: true,
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('heartbeat — timesync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emite packet 18 a cada 5s após startTimesync()', () => {
    const socket = makeMockSocket();
    // Plano 04 define o contrato exato; assume injeção do socket via construtor/factory.
    const transport = new BonkTransport(socket as never);
    transport.startTimesync();
    vi.advanceTimersByTime(5000);
    expect(socket.emit).toHaveBeenCalledWith(18, expect.anything());
  });
});

describe('disconnect cleanup', () => {
  it('chama socket.disconnect() e limpa timers internos', () => {
    const socket = makeMockSocket();
    const transport = new BonkTransport(socket as never);
    transport.startTimesync();
    transport.disconnect();
    expect(socket.disconnect).toHaveBeenCalled();
    // CONN-06: nenhum handle pendente — timers internos devem estar null após disconnect.
    expect((transport as unknown as { keepAliveTimer: unknown }).keepAliveTimer).toBeNull();
  });
});
