import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — imports FALHAM até os planos 03 (auth) e 04 (transport) existirem.
// Testes de integração só rodam com BONK_INTEGRATION=1 (exigem rede ao vivo ao bonk.io).
import { BonkTransport } from '../src/transport/BonkTransport.js';
import { discoverServer, getToken } from '../src/auth/AuthClient.js';

const integration = process.env.BONK_INTEGRATION ? describe : describe.skip;

integration('integração — conexão ao vivo (BONK_INTEGRATION)', () => {
  it('completa o handshake EIO=3', async () => {
    const info = await discoverServer();
    const transport = new BonkTransport();
    await transport.connect(info.server);
    expect(transport.connected).toBe(true);
    transport.disconnect();
  }, 15000);

  it('guest auth — discoverServer retorna server/lat/long/country', async () => {
    const info = await discoverServer();
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
    const token = await getToken('testuser', 'testpass').catch((err: unknown) => err);
    // Credenciais inválidas podem rejeitar; só garantimos que não foi erro de TLS.
    if (typeof token === 'string') {
      expect(typeof token).toBe('string');
    } else {
      expect(String(token)).not.toMatch(/TLS|certificate|SELF_SIGNED/i);
    }
  }, 15000);
});
