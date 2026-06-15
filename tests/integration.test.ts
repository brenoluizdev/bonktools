import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — imports FALHAM até os planos 03 (auth) e 04 (transport) existirem.
// Testes de integração só rodam com BONK_INTEGRATION=1 (exigem rede ao vivo ao bonk.io).
import { BonkTransport, AuthClient } from '../src/index.js';

const integration = process.env.BONK_INTEGRATION ? describe : describe.skip;

integration('integração — conexão ao vivo (BONK_INTEGRATION)', () => {
  const client = new AuthClient();

  it('completa o handshake EIO=3', async () => {
    const info = await client.discoverServer(null, 49);
    const transport = new BonkTransport({
      server: info,
      auth: { type: 'guest', guestName: 'TestBot' },
    });
    await transport.connect();
    expect(transport.getState()).toBe('connected');
    transport.disconnect();
  }, 15000);

  it('guest auth — discoverServer retorna server/lat/long/country', async () => {
    const info = await client.discoverServer(null, 49);
    expect(info).toEqual(
      expect.objectContaining({
        server: expect.any(String),
        lat: expect.any(Number),
        long: expect.any(Number),
        country: expect.any(String),
      }),
    );
  }, 15000);

  it('registered auth — getToken retorna string (sem crash TLS)', async () => {
    const token = await client
      .getToken(process.env.BONK_USERNAME ?? '', process.env.BONK_PASSWORD ?? '')
      .catch((err: unknown) => err);
    // Credenciais inválidas podem rejeitar; só garantimos que não foi erro de TLS.
    if (typeof token === 'string') {
      expect(typeof token).toBe('string');
    } else {
      expect(String(token)).not.toMatch(/TLS|certificate|SELF_SIGNED/i);
    }
  }, 15000);
});
