// Script manual (fora de `pnpm test`) pra descobrir os nomes reais dos campos de posição/velocidade
// que o client do bonk.io usa internamente, através do PhysicsSimulator. Roda contra o client REAL
// (baixado de bonk.io na primeira execução) — não é determinístico como os testes com client falso.
//
// Rodar depois de `pnpm build` (importa de dist/, sem precisar de um runner de TypeScript):
//   node examples/dump-state.mjs
import { PhysicsSimulator } from '../dist/index.js';

const sim = new PhysicsSimulator();

console.log('carregando client do bonk.io (baixa na primeira vez)...');
await sim.start();
console.log('simulador pronto.\n');

const initial = await sim.reset([null, { id: 1, team: 3 }, { id: 2, team: 2 }]);
console.log('=== estado inicial (reset) ===');
console.log(JSON.stringify(initial, null, 2));

// `ftu` no estado inicial começa em 120 (freeze de ~4s a 30fps antes do jogador poder se mexer,
// igual ao "congelamento" do início de partida real) — segura 150 quadros pra passar dele.
console.log('\n=== jogador 1 segurando "direita" por 150 quadros (atravessa o freeze inicial) ===');
let last;
for (let i = 0; i < 150; i++) {
  last = await sim.step({ 1: 2 }); // bit 2 = right
}
const disc1 = last.state.discs[1];
console.log(`ftu final: ${last.state.ftu}, disc do jogador 1: x=${disc1.x.toFixed(2)} xv=${disc1.xv.toFixed(2)}`);
console.log(JSON.stringify(last, null, 2));

sim.close();
