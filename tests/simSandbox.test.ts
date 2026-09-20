import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import { simWorkerOptions } from '../src/score/simSandbox.js';
import { SIM_WORKER_SOURCE } from '../src/score/simWorker.js';

/**
 * O código do client do bonk.io é de terceiros e baixado em runtime. Aqui um "client" falso e MALICIOSO tenta sair
 * do contexto isolado por todos os caminhos clássicos; nenhum pode dar acesso ao Node.
 */
const FAKE_ALPHA = `
function B(){}
function Y(){}
requirejs(['x'], function (io, Peer, Box2D) {
  B.prototype.step = function () {};
  B.createNewState = function () {
    var r = {};
    function t(name, f) { try { r[name] = String(f()); } catch (e) { r[name] = 'ERR:' + (e && e.name); } }
    t('process', function () { return typeof process; });
    t('Buffer', function () { return typeof Buffer; });
    t('fetch', function () { return typeof fetch; });
    t('nodeRequire', function () { return typeof require('fs').readFileSync; });
    t('moduleGlobal', function () { return typeof module + typeof exports + typeof __dirname; });
    t('globalCtor', function () { return (function () { return this; })().constructor.constructor('return typeof process')(); });
    t('thisCtor', function () { return this.constructor.constructor('return typeof process')(); });
    t('stubProtoEscape', function () { return Object.getPrototypeOf(__stub('a')).constructor.constructor('return typeof process')(); });
    t('newFunction', function () { return new Function('return typeof process')(); });
    t('evalProcess', function () { return eval('typeof process'); });
    t('stackTraceHook', function () {
      Error.prepareStackTrace = function (e, sites) { return sites; };
      return typeof new Error('x').stack;
    });
    t('stackFn', function () {
      var e = new Error('x'); Error.captureStackTrace(e);
      return typeof e.stack;
    });
    t('wasm', function () { return new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); });
    t('arrayProtoCtor', function () { return [].constructor.constructor('return typeof process')(); });
    t('promiseCtor', function () { return Promise.resolve().constructor.constructor('return typeof process')(); });
    return { probes: r };
  };
  B.loop = function () { while (true) {} };
});
`;

let tmp = '';
let worker: Worker | null = null;
afterEach(async () => {
  await worker?.terminate();
  worker = null;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = '';
});

function start(alpha: string, vmTimeoutMs = 60_000): Promise<Worker> {
  tmp = mkdtempSync(path.join(tmpdir(), 'bk-sandbox-'));
  writeFileSync(path.join(tmp, 'SafeTrig.js'), 'var SafeTrig = {};');
  writeFileSync(path.join(tmp, 'Box2D.js'), 'define(function () { return {}; });');
  writeFileSync(path.join(tmp, 'alpha2s.js'), alpha);
  const w = new Worker(SIM_WORKER_SOURCE, simWorkerOptions(tmp, vmTimeoutMs));
  worker = w;
  return new Promise((resolve, reject) => {
    w.on('message', (m: { type: string; message?: string }) => (m.type === 'ready' ? resolve(w) : m.type === 'error' ? reject(new Error(m.message)) : undefined));
    w.once('error', reject);
  });
}

const ask = (w: Worker, msg: Record<string, unknown>, want: string): Promise<Record<string, unknown>> =>
  new Promise((resolve, reject) => {
    const on = (m: Record<string, unknown>): void => {
      if (m['type'] === want) (w.off('message', on), resolve(m));
      else if (m['type'] === 'error') (w.off('message', on), reject(new Error(String(m['message']))));
    };
    w.on('message', on);
    w.postMessage(msg);
  });

describe('isolamento do código do jogo (alpha2s.js)', () => {
  it('um client malicioso não alcança process, require, rede nem o Function do worker', async () => {
    const w = await start(FAKE_ALPHA);
    const res = (await ask(w, { type: 'create', reqId: 1, players: [], seed: 0 }, 'created'))['state'] as { probes: Record<string, string> };
    const p = res.probes;
    // nenhum caminho pode ter devolvido o Node: sempre "undefined" ou erro
    expect(p['process']).toBe('undefined');
    expect(p['Buffer']).toBe('undefined');
    expect(p['fetch']).toBe('undefined');
    expect(p['nodeRequire']).toMatch(/^(undefined|ERR:)/);
    expect(p['moduleGlobal']).toBe('undefinedundefinedundefined');
    for (const k of ['globalCtor', 'thisCtor', 'stubProtoEscape', 'newFunction', 'evalProcess', 'arrayProtoCtor', 'promiseCtor']) {
      expect(p[k], k).toMatch(/^(undefined|ERR:)/);
    }
    expect(p['stackTraceHook']).toBe('string'); // o hook de stack trace não vale: continua texto
    expect(p['stackFn']).toBe('string');
    expect(p['wasm']).toMatch(/^ERR:/);
  });

  it('um laço infinito no código do jogo é interrompido (a sala não trava)', async () => {
    const w = await start(FAKE_ALPHA.replace("t('process'", "if (globalThis.__spin) { B.loop(); } t('process'").replace('B.createNewState = function () {', 'B.createNewState = function () { globalThis.__spin = true;'), 400);
    await expect(ask(w, { type: 'create', reqId: 1, players: [], seed: 0 }, 'created')).rejects.toThrow(/timed out/i);
  });

  it('o worker não herda o ambiente do processo (chave da API) e tem memória limitada', () => {
    const o = simWorkerOptions('x', 1000);
    expect(o.env).toEqual({});
    expect(o.resourceLimits.maxOldGenerationSizeMb).toBeLessThanOrEqual(1024);
  });
});
