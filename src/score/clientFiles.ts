import fs from 'node:fs';
import path from 'node:path';

/** Arquivos do client do bonk.io de que o simulador precisa (local remoto relativo a `baseUrl`). */
export const CLIENT_FILES: ReadonlyArray<readonly [string, string]> = [
  ['alpha2s.js', 'alpha2s.js'],
  ['Box2D.js', 'physics/box2dweb/Box2DModuleGJMod.js'],
  ['SafeTrig.js', 'SafeTrig.js'],
];

/**
 * Garante que os arquivos do client do bonk.io (de terceiros, não incluídos neste pacote) existem em
 * `cacheDir`, baixando de `baseUrl` os que faltarem. Compartilhado por `ScoreTracker` e `PhysicsSimulator`
 * — os dois rodam o mesmo client num worker sandboxed (`simSandbox.ts`).
 */
export async function ensureClientFiles(cacheDir: string, baseUrl: string): Promise<void> {
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const [name, remote] of CLIENT_FILES) {
    const file = path.join(cacheDir, name);
    if (fs.existsSync(file)) continue;
    const res = await fetch(baseUrl + remote);
    if (!res.ok) throw new Error(`falha ao baixar ${remote}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}
