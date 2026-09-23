// Código do worker do simulador (string para funcionar nos builds ESM e CJS sem arquivo extra).
//
// ISOLAMENTO: o código do client do bonk.io é de terceiros e baixado em runtime. Ele roda num contexto V8 separado
// (`vm.createContext`) SEM `process`, `require`, `fetch`, arquivos nem rede, e só recebe/entrega TEXTO (JSON): nenhum
// objeto deste worker é entregue ao contexto. Este código é estrito de propósito (frames "sloppy" vazariam pelo
// stack trace). Os scripts que rodam dentro do contexto estão em `simSandbox.ts` (chegam em `workerData.sources`).
// Não use crases nem ${ } dentro do código abaixo.
export const SIM_WORKER_SOURCE = String.raw`
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const S = workerData.sources;
// Teto de CPU por chamada ao código do jogo (um laço infinito nele não trava a aplicação).
const LIMIT_MS = workerData.vmTimeoutMs || 30000;
let ctx = null;

function run(code, filename, timeout) {
  return vm.runInContext(code, ctx, { filename: filename, timeout: timeout || LIMIT_MS });
}

function loadClient(dir) {
  ctx = vm.createContext(Object.create(null), { name: 'bonk-client', codeGeneration: { strings: true, wasm: false } });
  run(S.boot, 'boot.js');
  run(S.env, 'env.js');
  run(fs.readFileSync(path.join(dir, 'SafeTrig.js'), 'utf8') + '\nglobalThis.SafeTrig = SafeTrig;', 'SafeTrig.js');
  run(S.beforeBox2d, 'box2d-pre.js');
  run(fs.readFileSync(path.join(dir, 'Box2D.js'), 'utf8'), 'Box2D.js');
  run(S.beforeClient, 'client-pre.js');

  let src = fs.readFileSync(path.join(dir, 'alpha2s.js'), 'utf8');
  const hook = 'function B(){}';
  if (!src.includes(hook)) throw new Error('client mudou: não achei a classe de física do football');
  src = src.replace(hook, hook + 'Object.defineProperty(globalThis,"__PB",{configurable:true,get:()=>B});');
  run(src, 'alpha2s.js', 60000);
  run(S.driver, 'driver.js');
}

// Chama a ponte do contexto: entra uma string JSON, sai uma string JSON.
function call(fn, arg) {
  ctx.__in = JSON.stringify(arg === undefined ? null : arg);
  const out = run('__api.' + fn + '(__in)', 'call.js');
  if (typeof out !== 'string') throw new Error('resposta inválida do client');
  return JSON.parse(out);
}

const msgOf = (err) => {
  try {
    const m = err && err.message;
    return typeof m === 'string' ? m : 'erro no client';
  } catch {
    return 'erro no client';
  }
};

parentPort.on('message', (m) => {
  try {
    if (m.type === 'create') {
      // Estado inicial de football pelo próprio jogo.
      parentPort.postMessage({ type: 'created', reqId: m.reqId, state: call('create', { players: m.players, seed: m.seed || 0 }) });
    } else if (m.type === 'start') {
      call('start', { state: m.state, gs: m.gs });
    } else if (m.type === 'input') {
      call('input', { id: m.id, i: m.i, f: m.f, c: m.c || 0 });
    } else if (m.type === 'step') {
      parentPort.postMessage({ type: 'stepped', reqId: m.reqId, result: call('step', { actions: m.actions, frames: m.frames || 1 }) });
    } else if (m.type === 'tick') {
      const result = call('tick', { target: m.target });
      for (const g of result.goals) parentPort.postMessage({ type: 'goal', team: g.team, scores: g.scores, frame: g.frame });
      parentPort.postMessage({ type: 'tickState', state: result.state, frame: result.frame });
    } else if (m.type === 'stop') {
      call('stop');
    }
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: msgOf(err) });
  }
});

try {
  loadClient(workerData.dir);
  parentPort.postMessage({ type: 'ready' });
} catch (err) {
  parentPort.postMessage({ type: 'error', message: msgOf(err) });
}
`;
