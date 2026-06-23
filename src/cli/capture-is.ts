#!/usr/bin/env node
/**
 * capture-is — captura o IS blob de uma sala football bonk.io.
 *
 * Uso:
 *   npx @bonktools/core capture-is <URL_DA_SALA>
 *
 * Variáveis de ambiente necessárias:
 *   BONK_USERNAME  — usuário registrado do bonk.io
 *   BONK_PASSWORD  — senha da conta
 *
 * Exemplo:
 *   BONK_USERNAME=myuser BONK_PASSWORD=mypass npx @bonktools/core capture-is https://bonk.io/abc123
 *
 * O script entra na sala como espectador e aguarda GAME_START.
 * Quando o host iniciar o jogo no browser, o IS blob será exibido.
 */

import { joinRoom } from '../room/factories.js';

const roomUrl = process.argv[2];
if (!roomUrl) {
  process.stderr.write('Uso: npx @bonktools/core capture-is <URL_DA_SALA>\n');
  process.stderr.write('Exemplo: BONK_USERNAME=myuser BONK_PASSWORD=mypass npx @bonktools/core capture-is https://bonk.io/abc123\n');
  process.exit(1);
}

const username = process.env.BONK_USERNAME;
const password = process.env.BONK_PASSWORD;

if (!username || !password) {
  process.stderr.write('Erro: defina BONK_USERNAME e BONK_PASSWORD como variáveis de ambiente.\n');
  process.stderr.write('Exemplo: BONK_USERNAME=myuser BONK_PASSWORD=mypass npx @bonktools/core capture-is <URL>\n');
  process.exit(1);
}

process.stdout.write(`Entrando na sala ${roomUrl} como espectador...\n`);

const room = await joinRoom(roomUrl, {
  auth: { type: 'registered', username, password },
  role: 'spectator',
});

process.stdout.write('Na sala. Inicie o jogo no browser como host e aguarde...\n');

await new Promise<void>((resolve) => {
  room.on('game-start', (pkt) => {
    const blob = typeof pkt.is === 'string' ? pkt.is : '';
    if (blob.length > 0) {
      process.stdout.write('\n========== COPIE ESTA LINHA PARA O .env ==========\n');
      process.stdout.write(`BONK_INITIAL_STATE=${blob}\n`);
      process.stdout.write('====================================================\n\n');
      process.stdout.write(`Blob capturado: ${blob.length} chars\n`);
    } else {
      process.stderr.write('GAME_START recebido mas is está vazio — inicie o jogo com um blob válido.\n');
    }
    resolve();
  });

  room.on('room-dead', (reason) => {
    process.stderr.write(`Sala morreu antes do GAME_START: ${JSON.stringify(reason)}\n`);
    resolve();
  });
});

room.disconnect();
process.exit(0);
