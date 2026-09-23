// Scripts que rodam DENTRO do contexto isolado (`vm.createContext`) onde fica o código do client do bonk.io
// (mesmo modelo do simulador de replays da BonkTools-Room).
// O código do jogo é de terceiros e baixado em runtime; ele não pode alcançar `process`, `require`, rede nem arquivos.
//
// Regras deste arquivo (para o isolamento valer):
//  - NADA do Node entra no contexto: só texto (código-fonte e JSON). Qualquer objeto criado FORA e entregue ao
//    contexto daria ao código do jogo um caminho de volta (`obj.constructor.constructor('return process')()`).
//    Por isso os stubs, o LZString e a ponte JSON são todos criados aqui dentro.
//  - Não use crases, `${` nem barras invertidas: são strings (String.raw) montadas em tempo de execução.

/** Primeiro script: endurece o contexto antes de qualquer código do jogo. */
export const BOOT_SOURCE = String.raw`
(function () {
  var g = globalThis;
  // Sem stack traces customizados: é por onde objetos "de fora" (frames do host) costumam vazar para dentro.
  try { Object.defineProperty(Error, 'prepareStackTrace', { value: undefined, writable: false, configurable: false }); } catch (e) { /* ignora */ }
  function stub(name) {
    var fn = function () { return proxy; };
    var proxy = new Proxy(fn, {
      get: function (_, k) {
        if (k === Symbol.toPrimitive) return function () { return 0; };
        if (k === 'then') return undefined;
        if (k === 'length') return 0;
        return stub(name + '.' + String(k));
      },
      set: function () { return true; },
      apply: function () { return proxy; },
      construct: function () { return proxy; },
      has: function () { return true; }
    });
    return proxy;
  }
  Object.defineProperty(g, '__stub', { value: stub, configurable: true, writable: true });
})();
`;

/** Depois do LZString (se houver): ambiente de navegador falso que o client espera. */
export const ENV_SOURCE = String.raw`
(function () {
  var g = globalThis;
  g.window = g;
  g.self = g;
  var names = ['document', 'localStorage', 'sessionStorage', '$', 'jQuery', 'PIXI', 'Howl', 'Howler', 'TWEEN', 'anime', 'moment', 'io', 'Peer', 'pako', 'PSON', 'dcodeIO', 'requestAnimationFrame', 'cancelAnimationFrame', 'XMLHttpRequest', 'Image', 'Audio', 'alert', 'GameResources', 'timesync', 'getComputedStyle', 'AudioContext', 'screen', 'innerWidth', 'innerHeight', 'addEventListener', 'removeEventListener', 'HTMLElement', 'MutationObserver', 'ResizeObserver'];
  // LZString REAL (o decodificador de mapas do jogo o usa); sem ele, vira stub como os demais.
  if (typeof g.LZString === 'undefined') names.push('LZString');
  for (var i = 0; i < names.length; i++) {
    Object.defineProperty(g, names[i], { value: g.__stub(names[i]), configurable: true, writable: true });
  }
  // Globais de plataforma que o client usa, reimplementados aqui dentro em JS puro (nada do Node entra).
  function TextEncoder() {}
  TextEncoder.prototype.encode = function (str) {
    str = String(str === undefined ? '' : str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  };
  TextEncoder.prototype.encoding = 'utf-8';
  function TextDecoder() {}
  TextDecoder.prototype.decode = function (buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf && buf.buffer ? buf.buffer : buf || 0);
    var s = '';
    for (var i = 0; i < b.length; ) {
      var c = b[i++];
      var cp;
      if (c < 0x80) cp = c;
      else if (c >= 0xc0 && c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
      else if (c >= 0xe0 && c < 0xf0) { cp = ((c & 15) << 12) | ((b[i] & 63) << 6) | (b[i + 1] & 63); i += 2; }
      else { cp = ((c & 7) << 18) | ((b[i] & 63) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; }
      if (cp >= 0x10000) { cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
      else s += String.fromCharCode(cp);
    }
    return s;
  };
  TextDecoder.prototype.encoding = 'utf-8';
  var noop = function () {};
  var extra = { TextEncoder: TextEncoder, TextDecoder: TextDecoder, console: { log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop, assert: noop, time: noop, timeEnd: noop },
    setTimeout: function () { return 0; }, clearTimeout: noop, setInterval: function () { return 0; }, clearInterval: noop, queueMicrotask: noop,
    performance: { now: function () { return Date.now(); } } };
  for (var k in extra) Object.defineProperty(g, k, { value: extra[k], configurable: true, writable: true });
  // O client só executa o código de jogo se estiver no domínio do bonk.io.
  Object.defineProperty(g, 'location', { value: { hostname: 'bonk.io', host: 'bonk.io', href: 'https://bonk.io/gameframe-release.html', origin: 'https://bonk.io', protocol: 'https:', pathname: '/gameframe-release.html', search: '', hash: '', port: '' }, configurable: true, writable: true });
  Object.defineProperty(g, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36', platform: 'Win32', language: 'en-US', languages: ['en-US'], webdriver: false }, configurable: true, writable: true });
})();
`;

/** Antes do Box2D.js: o módulo AMD entrega o Box2D por `define`. */
export const BEFORE_BOX2D_SOURCE = String.raw`var __Box2D; globalThis.define = function (f) { __Box2D = f(); };`;

/** Depois do Box2D.js e antes do alpha2s.js: `requirejs` captura o callback principal do client. */
export const BEFORE_CLIENT_SOURCE = String.raw`
globalThis.Box2D = __Box2D;
var __cb;
globalThis.requirejs = function (_deps, f) { __cb = f; };
globalThis.require = globalThis.requirejs;
globalThis.define = function () {};
`;

/** Depois do alpha2s.js: liga o client e monta a ponte JSON (texto entra, texto sai). Toda a simulação vive AQUI dentro. */
export const DRIVER_SOURCE = String.raw`
(function () {
  var g = globalThis;
  __cb(g.__stub('io'), g.__stub('Peer'), g.Box2D);
  var B = g.__PB;
  if (!B || !B.prototype || typeof B.prototype.step !== 'function') throw new Error('client mudou: classe de física sem step()');

  function keys(i) { return { left: !!(i & 1), right: !!(i & 2), up: !!(i & 4), down: !!(i & 8), action: !!(i & 16), action2: !!(i & 32) }; }
  var CHECKPOINT_EVERY = 30;
  var sim = null;

  // Cópia profunda escrita aqui dentro (o structuredClone do Node não existe no contexto). Preserva -0, NaN,
  // undefined e arrays tipados, como o structuredClone fazia.
  function clone(v) {
    if (v === null || typeof v !== 'object') return v;
    if (ArrayBuffer.isView(v)) return new v.constructor(v);
    if (Array.isArray(v)) { var a = new Array(v.length); for (var i = 0; i < v.length; i++) if (i in v) a[i] = clone(v[i]); return a; }
    if (v instanceof Map) { var m = new Map(); v.forEach(function (x, k) { m.set(clone(k), clone(x)); }); return m; }
    if (v instanceof Set) { var s = new Set(); v.forEach(function (x) { s.add(clone(x)); }); return s; }
    var o = {};
    var ks = Object.keys(v);
    for (var j = 0; j < ks.length; j++) o[ks[j]] = clone(v[ks[j]]);
    return o;
  }

  function keyStateAt(events, frame) {
    var byId = new Map();
    for (var i = 0; i < events.length; i++) { var e = events[i]; if (e.f <= frame) byId.set(e.id, e.i); else break; }
    var inputs = [];
    byId.forEach(function (i, id) { inputs[id] = keys(i); });
    return inputs;
  }

  function rollbackTo(frame) {
    var cp = sim.checkpoints[0];
    for (var i = 0; i < sim.checkpoints.length; i++) if (sim.checkpoints[i].f <= frame) cp = sim.checkpoints[i];
    sim.cur = { f: cp.f, state: clone(cp.state) };
    sim.checkpoints = sim.checkpoints.filter(function (c) { return c.f <= cp.f; });
  }

  // Devolve os pontos novos (acima do maior já anunciado: re-simulação por input atrasado não repete o aviso).
  function advance(target) {
    var goals = [];
    var guard = 0;
    while (sim.cur.f < target && guard++ < 4000) {
      var inputs = keyStateAt(sim.events, sim.cur.f);
      var next = sim.inst.step(sim.cur.state, inputs, null, 30, sim.gs, 1);
      sim.cur = { f: sim.cur.f + 1, state: next };
      if (sim.cur.f % CHECKPOINT_EVERY === 0) sim.checkpoints.push({ f: sim.cur.f, state: clone(next) });
      var scores = Array.from(next.scores || []);
      for (var idx = 0; idx < scores.length; idx++) {
        var v = scores[idx] || 0;
        if (v > (sim.maxScores[idx] || 0)) { sim.maxScores[idx] = v; goals.push({ team: idx, scores: scores, frame: sim.cur.f }); }
      }
    }
    return goals;
  }

  Object.defineProperty(g, '__api', {
    configurable: true,
    value: {
      create: function (json) {
        var m = JSON.parse(json);
        var made = B.createNewState(m.players, null, m.seed || 0, false, null, false);
        made.rc = 0;
        return JSON.stringify(made);
      },
      start: function (json) {
        var m = JSON.parse(json);
        sim = { inst: new B(), gs: m.gs, events: [], cur: { f: 0, state: m.state }, checkpoints: [{ f: 0, state: clone(m.state) }], maxScores: Array.from(m.state.scores || []) };
        return '[]';
      },
      input: function (json) {
        if (!sim) return '[]';
        var m = JSON.parse(json);
        var e = { id: m.id, i: m.i, f: m.f, c: m.c || 0 };
        var idx = sim.events.length;
        while (idx > 0 && (sim.events[idx - 1].f > e.f || (sim.events[idx - 1].f === e.f && sim.events[idx - 1].c > e.c))) idx--;
        sim.events.splice(idx, 0, e);
        if (e.f < sim.cur.f) rollbackTo(e.f);
        return '[]';
      },
      tick: function (json) {
        if (!sim) return JSON.stringify({ goals: [], state: null, frame: 0 });
        var goals = advance(JSON.parse(json).target);
        return JSON.stringify({ goals: goals, state: sim.cur.state, frame: sim.cur.f });
      },
      // Avança exatamente 1 quadro sob controle total do chamador (sem fila de eventos nem
      // rollback — esses existem só para absorver o atraso de rede das partidas ao vivo, ver
      // "input"/"tick" acima). Usado pelo PhysicsSimulator para treino offline (RL).
      step: function (json) {
        if (!sim) return JSON.stringify({ state: null, frame: 0, goals: [] });
        var m = JSON.parse(json);
        var acts = m.actions || {};
        var inputs = [];
        for (var pid in acts) { if (Object.prototype.hasOwnProperty.call(acts, pid)) inputs[pid] = keys(acts[pid]); }
        // "frames": mesmo input segurado por N quadros numa chamada só (action repeat do RL) — evita N idas e
        // voltas worker<->processo e N serializações do estado inteiro.
        var frames = Math.max(1, Math.min(60, (m.frames | 0) || 1));
        var next = sim.cur.state;
        var goals = [];
        for (var n = 0; n < frames; n++) {
          next = sim.inst.step(sim.cur.state, inputs, null, 30, sim.gs, 1);
          sim.cur = { f: sim.cur.f + 1, state: next };
          var scores = Array.from(next.scores || []);
          for (var idx = 0; idx < scores.length; idx++) {
            var v = scores[idx] || 0;
            if (v > (sim.maxScores[idx] || 0)) { sim.maxScores[idx] = v; goals.push({ team: idx, scores: scores, frame: sim.cur.f }); }
          }
        }
        return JSON.stringify({ state: next, frame: sim.cur.f, goals: goals });
      },
      stop: function () { sim = null; return '[]'; }
    }
  });
})();
`;

/**
 * Opções do `Worker` do simulador: o código do jogo é de terceiros, então o worker não herda o ambiente do processo
 * e tem a memória limitada.
 */
export function simWorkerOptions(dir: string, vmTimeoutMs = 30_000) {
  return {
    eval: true,
    workerData: {
      dir,
      vmTimeoutMs,
      sources: { boot: BOOT_SOURCE, env: ENV_SOURCE, beforeBox2d: BEFORE_BOX2D_SOURCE, beforeClient: BEFORE_CLIENT_SOURCE, driver: DRIVER_SOURCE },
    },
    env: {},
    resourceLimits: { maxOldGenerationSizeMb: 768, maxYoungGenerationSizeMb: 64 },
  };
}
