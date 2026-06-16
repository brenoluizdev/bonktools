import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — imports FALHAM até o plano 02-02 criar BonkRoom.ts e exportar de index.ts.
// Testes de integração só rodam com BONK_INTEGRATION=1 (exigem rede ao vivo ao bonk.io).
import { BonkRoom, AuthClient } from '../src/index.js';

// Guard idêntico ao integration.test.ts da Fase 1: skip quando BONK_INTEGRATION não está setado.
const integration = process.env.BONK_INTEGRATION ? describe : describe.skip;

integration('BonkRoom — integração ao vivo (BONK_INTEGRATION)', () => {
  it(
    'connect() → evento room-join → room.state.myId !== null',
    async () => {
      const user = process.env.BONK_USER;
      const pass = process.env.BONK_PASS;

      // Pular se credenciais não fornecidas (ambiente de CI sem .env)
      if (!user || !pass) {
        console.warn('BONK_USER/BONK_PASS não definidos — pulando teste de integração BonkRoom');
        return;
      }

      const client = new AuthClient();
      const token = await client.getToken(user, pass);
      const server = await client.discoverServer(token, 49);

      const room = new BonkRoom({
        desiredState: {
          roomName: 'BonkTools Integration Test',
          password: '',
          mode: 0,
          rounds: 3,
        },
        transport: { server, auth: { type: 'registered', token } },
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          room.disconnect();
          reject(new Error('Timeout: room-join não recebido em 15s'));
        }, 14000);

        room.once('room-join', () => {
          clearTimeout(timeout);
          expect(room.state.myId).not.toBeNull();
          room.disconnect();
          resolve();
        });

        room.connect().catch((err: unknown) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    },
    15000,
  );
});
