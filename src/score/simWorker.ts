// Código do worker do simulador (string para funcionar nos builds ESM e CJS sem arquivo extra).
// Não use crases nem ${ } dentro do código abaixo.
export const SIM_WORKER_SOURCE = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function stub(name = 'stub') {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(_, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return stub(name + '.' + String(k));
    },
    set() { return true; }, apply() { return proxy; }, construct() { return proxy; }, has() { return true; },
  });
  return proxy;
}

function loadClient(dir) {
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  for (const k of ['document', 'localStorage', 'sessionStorage', '$', 'jQuery', 'PIXI', 'Howl', 'Howler', 'TWEEN', 'anime', 'moment', 'io', 'Peer', 'pako', 'PSON', 'dcodeIO', 'LZString', 'requestAnimationFrame', 'cancelAnimationFrame', 'XMLHttpRequest', 'Image', 'Audio', 'alert', 'GameResources', 'timesync', 'getComputedStyle', 'AudioContext', 'screen', 'innerWidth', 'innerHeight', 'addEventListener', 'removeEventListener', 'HTMLElement', 'MutationObserver', 'ResizeObserver']) {
    try { Object.defineProperty(globalThis, k, { value: stub(k), configurable: true, writable: true }); } catch { /* ignora */ }
  }
  // O client só executa o código de jogo se estiver no domínio do bonk.io.
  const location = { hostname: 'bonk.io', host: 'bonk.io', href: 'https://bonk.io/gameframe-release.html', origin: 'https://bonk.io', protocol: 'https:', pathname: '/gameframe-release.html', search: '', hash: '', port: '' };
  const navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', platform: 'Win32', language: 'en-US', languages: ['en-US'], webdriver: false };
  Object.defineProperty(globalThis, 'location', { value: location, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true, writable: true });

  vm.runInThisContext(fs.readFileSync(path.join(dir, 'SafeTrig.js'), 'utf8') + '\nglobalThis.SafeTrig = SafeTrig;');
  let Box2D;
  globalThis.define = (f) => { Box2D = f(); };
  vm.runInThisContext(fs.readFileSync(path.join(dir, 'Box2D.js'), 'utf8'));
  globalThis.Box2D = Box2D;

  let cb;
  globalThis.requirejs = (_deps, f) => { cb = f; };
  globalThis.require = globalThis.requirejs;
  globalThis.define = () => {};

  let src = fs.readFileSync(path.join(dir, 'alpha2s.js'), 'utf8');
  const hook = 'function B(){}';
  if (!src.includes(hook)) throw new Error('client mudou: não achei a classe de física do football');
  src = src.replace(hook, hook + 'Object.defineProperty(globalThis,"__PB",{configurable:true,get:()=>B});');
  vm.runInThisContext(src, { filename: 'alpha2s.js' });
  cb(stub('io'), stub('Peer'), Box2D);
  const B = globalThis.__PB;
  if (!B || !B.prototype || typeof B.prototype.step !== 'function') throw new Error('client mudou: classe de física sem step()');
  return B;
}

const keys = (i) => ({ left: !!(i & 1), right: !!(i & 2), up: !!(i & 4), down: !!(i & 8), action: !!(i & 16), action2: !!(i & 32) });
const CHECKPOINT_EVERY = 30;

let B = null;
let sim = null;

function keyStateAt(events, frame) {
  const byId = new Map();
  for (const e of events) { if (e.f <= frame) byId.set(e.id, e.i); else break; }
  const inputs = [];
  for (const [id, i] of byId) inputs[id] = keys(i);
  return inputs;
}

function rollbackTo(frame) {
  let cp = sim.checkpoints[0];
  for (const c of sim.checkpoints) if (c.f <= frame) cp = c;
  sim.cur = { f: cp.f, state: structuredClone(cp.state) };
  sim.checkpoints = sim.checkpoints.filter((c) => c.f <= cp.f);
}

function advance(target) {
  let guard = 0;
  while (sim.cur.f < target && guard++ < 4000) {
    const inputs = keyStateAt(sim.events, sim.cur.f);
    const next = sim.inst.step(sim.cur.state, inputs, null, 30, sim.gs, 1);
    sim.cur = { f: sim.cur.f + 1, state: next };
    if (sim.cur.f % CHECKPOINT_EVERY === 0) sim.checkpoints.push({ f: sim.cur.f, state: structuredClone(next) });
    const scores = Array.from(next.scores || []);
    // Só anuncia pontos acima do maior já anunciado (re-simulação por input atrasado não repete o aviso).
    for (let idx = 0; idx < scores.length; idx++) {
      const v = scores[idx] || 0;
      if (v > (sim.maxScores[idx] || 0)) {
        sim.maxScores[idx] = v;
        parentPort.postMessage({ type: 'goal', team: idx, scores, frame: sim.cur.f });
      }
    }
  }
}

parentPort.on('message', (m) => {
  try {
    if (m.type === 'create') {
      const made = B.createNewState(m.players, null, m.seed || 0, false, null, false);
      made.rc = 0;
      parentPort.postMessage({ type: 'created', reqId: m.reqId, state: made });
    } else if (m.type === 'start') {
      sim = { inst: new B(), gs: m.gs, events: [], cur: { f: 0, state: m.state }, checkpoints: [{ f: 0, state: structuredClone(m.state) }], maxScores: Array.from(m.state.scores || []) };
    } else if (m.type === 'input' && sim) {
      const e = { id: m.id, i: m.i, f: m.f, c: m.c ?? 0 };
      let idx = sim.events.length;
      while (idx > 0 && (sim.events[idx - 1].f > e.f || (sim.events[idx - 1].f === e.f && sim.events[idx - 1].c > e.c))) idx--;
      sim.events.splice(idx, 0, e);
      if (e.f < sim.cur.f) rollbackTo(e.f);
    } else if (m.type === 'tick' && sim) {
      advance(m.target);
    } else if (m.type === 'stop') {
      sim = null;
    }
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: String(err && err.message || err) });
  }
});

try {
  B = loadClient(workerData.dir);
  parentPort.postMessage({ type: 'ready' });
} catch (err) {
  parentPort.postMessage({ type: 'error', message: String(err && err.message || err) });
}
`;
