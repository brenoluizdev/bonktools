// Conveniência de dev: roda `live-bot-room.mjs` reusando a conta registrada já configurada em
// BonkTools-Core-repo/apps/bonk-room/.env, sem passar pelo shell (evita o `source`/bash reinterpretar
// caracteres especiais da senha — foi exatamente isso que quebrou ao usar `source .env` direto).
//
// Uso: node examples/with-bonk-room-account.mjs
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '..', '..', 'BonkTools-Core-repo', 'apps', 'bonk-room', '.env');

const raw = readFileSync(envPath, 'utf8');
const vars = {};
for (const line of raw.split(/\r?\n/)) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (!m) continue;
  let [, key, value] = m;
  value = value.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  vars[key] = value;
}

if (!vars.BONK_USERNAME || !vars.BONK_PASSWORD) {
  console.error('BONK_USERNAME/BONK_PASSWORD não encontrados em', envPath);
  process.exit(1);
}

const target = path.join(here, 'live-bot-room.mjs');
const child = spawn(process.execPath, [target], {
  cwd: here,
  stdio: 'inherit',
  env: { ...process.env, BONK_USERNAME: vars.BONK_USERNAME, BONK_PASSWORD: vars.BONK_PASSWORD },
});
child.on('exit', (code) => process.exit(code ?? 0));
