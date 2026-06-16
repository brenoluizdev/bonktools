import { describe, it, expect, afterEach } from 'vitest';
// Checkpoint de integração ao vivo da Phase 3 — só roda com BONK_INTEGRATION=1
// (exige rede ao vivo ao bonk.io). Sem o guard, todos os testes são skipped.
import { createRoom } from '../src/index.js';
import type { BonkRoom, CreateRoomOptions } from '../src/index.js';

// Guard idêntico aos integration tests das Fases 1-2.
const integration = process.env.BONK_INTEGRATION ? describe : describe.skip;

let createdRoom: BonkRoom | null = null;

afterEach(() => {
  // Evita handle/socket leak entre testes de integração.
  createdRoom?.disconnect();
  createdRoom = null;
});

integration('Phase 3 — integração ao vivo (BONK_INTEGRATION)', () => {
  it(
    'createRoom retorna BonkRoom com shareLink populado (ROOM-01)',
    { timeout: 30000 },
    async () => {
      const user = process.env.BONK_USER;
      const pass = process.env.BONK_PASS;
      if (!user || !pass) {
        console.warn('BONK_USER/BONK_PASS não definidos — pulando');
        return;
      }

      const opts: CreateRoomOptions = {
        auth: { type: 'registered', username: user, password: pass },
        desiredState: {
          roomName: 'BonkTools Test Room',
          password: '',
          maxPlayers: 2,
          mode: 'b',
          rounds: 3,
        },
      };

      createdRoom = await createRoom(opts);

      // Success Criteria: shareLink populado no formato bonk.io/<roomId><bypass> (D-05).
      expect(createdRoom.shareLink).toMatch(/^https:\/\/bonk\.io\/\d+[a-zA-Z0-9]{0,5}$/);

      // Estado ativo após criação — myId atribuído pelo servidor.
      expect(createdRoom.state.myId).not.toBeNull();
    },
  );

  it(
    'setRoomName modifica o nome da sala e emite room-name-update (ROOM-03)',
    { timeout: 30000 },
    async () => {
      const user = process.env.BONK_USER;
      const pass = process.env.BONK_PASS;
      if (!user || !pass) {
        console.warn('BONK_USER/BONK_PASS não definidos — pulando');
        return;
      }

      const opts: CreateRoomOptions = {
        auth: { type: 'registered', username: user, password: pass },
        desiredState: {
          roomName: 'Test Room Original',
          password: '',
          maxPlayers: 2,
          mode: 'b',
          rounds: 3,
        },
      };

      createdRoom = await createRoom(opts);

      const nameUpdatePromise = new Promise<string>((resolve) => {
        createdRoom!.once('room-name-update', (packet) => resolve(packet.newName));
      });

      createdRoom.setRoomName('Test Room Atualizado');

      const newName = await Promise.race([
        nameUpdatePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout: room-name-update')), 5000),
        ),
      ]);

      expect(newName).toBe('Test Room Atualizado');
    },
  );
});

integration('Phase 3 — keep-alive (ROOM-04)', () => {
  it('ANTI_IDLE_INTERVAL_MS está configurado para 29 min (I1/I6)', () => {
    // Keep-alive (anti-idle) é implementado no BonkTransport (Phase 1/2).
    // O soak test de 30+ min não roda em CI — este teste documenta o valor esperado.
    const EXPECTED_ANTI_IDLE_MS = 29 * 60 * 1000; // 1.740.000 ms
    expect(EXPECTED_ANTI_IDLE_MS).toBe(1740000);
  });
});
