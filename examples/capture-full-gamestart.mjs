import { readFileSync } from 'node:fs';
import { joinRoom } from '../dist/index.js';

const raw = readFileSync('../BonkTools-Core-repo/apps/bonk-room/.env', 'utf8');
const vars = {};
for (const line of raw.split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (!m) continue;
  let [, k, v] = m;
  v = v.trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  vars[k] = v;
}

const roomUrl = process.argv[2];
const room = await joinRoom(roomUrl, {
  auth: { type: 'registered', username: vars.BONK_USERNAME, password: vars.BONK_PASSWORD },
  role: 'spectator',
});

console.log('Na sala, aguardando GAME_START...');

await new Promise((resolve) => {
  room.on('game-start', (pkt) => {
    console.log('=== GAME_START completo ===');
    console.log('gs:', JSON.stringify(pkt.gs, null, 2));
    console.log('is length:', typeof pkt.is === 'string' ? pkt.is.length : 0);
    resolve();
  });
  room.on('room-dead', (reason) => {
    console.error('sala morreu:', reason);
    resolve();
  });
});

room.disconnect();
process.exit(0);
