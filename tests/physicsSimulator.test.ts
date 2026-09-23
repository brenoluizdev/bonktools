import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsSimulator } from '../src/score/PhysicsSimulator.js';

/**
 * O client real do bonk.io é de terceiros e baixado em runtime (ver `clientFiles.ts`). Aqui um "client"
 * falso minimalista (mesmo esqueleto de `tests/simSandbox.test.ts`) fica no cacheDir para os arquivos
 * nunca serem baixados (`ensureClientFiles` só busca o que falta) e simula uma física trivial e
 * determinística: jogadores andam em x conforme left/right, e um bit de "ação" marca gol pro time 2.
 */
const FAKE_ALPHA = `
function B(){}
requirejs(['x'], function (io, Peer, Box2D) {
  B.createNewState = function (players) {
    var ps = [];
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      ps[i] = p ? { id: p.id, team: p.team, x: 0, y: 0 } : null;
    }
    return { players: ps, discs: [], scores: [0, 0, 0, 0, 0, 0] };
  };
  B.prototype.step = function (state, inputs) {
    var next = { players: [], discs: state.discs, scores: state.scores.slice() };
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (!p) { next.players[i] = null; continue; }
      var inp = inputs[i] || {};
      var dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      next.players[i] = { id: p.id, team: p.team, x: p.x + dx, y: p.y };
      if (inp.action) next.scores[2] = (next.scores[2] || 0) + 1;
    }
    return next;
  };
});
`;

let tmp = '';
let sim: PhysicsSimulator | null = null;

afterEach(() => {
  sim?.close();
  sim = null;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = '';
});

function fakeClientDir(): string {
  tmp = mkdtempSync(path.join(tmpdir(), 'bk-physics-'));
  writeFileSync(path.join(tmp, 'SafeTrig.js'), 'var SafeTrig = {};');
  writeFileSync(path.join(tmp, 'Box2D.js'), 'define(function () { return {}; });');
  writeFileSync(path.join(tmp, 'alpha2s.js'), FAKE_ALPHA);
  return tmp;
}

describe('PhysicsSimulator', () => {
  it('reset() cria o estado inicial e não toca a rede (arquivos já presentes no cacheDir)', async () => {
    sim = new PhysicsSimulator({ cacheDir: fakeClientDir() });
    await sim.start();
    expect(sim.ready).toBe(true);

    const state = (await sim.reset([null, { id: 1, team: 3 }, { id: 2, team: 2 }])) as { players: Array<{ x: number } | null> };
    expect(state.players[1]?.x).toBe(0);
    expect(state.players[2]?.x).toBe(0);
  });

  it('step() avança exatamente 1 quadro sob o input dado', async () => {
    sim = new PhysicsSimulator({ cacheDir: fakeClientDir() });
    await sim.start();
    await sim.reset([null, { id: 1, team: 3 }, { id: 2, team: 2 }]);

    const right = await sim.step({ 1: 2 }); // bit 2 = right, jogador id 1
    expect(right.frame).toBe(1);
    expect((right.state as { players: Array<{ x: number } | null> }).players[1]?.x).toBe(1);

    const left = await sim.step({ 1: 1 }); // bit 1 = left
    expect(left.frame).toBe(2);
    expect((left.state as { players: Array<{ x: number } | null> }).players[1]?.x).toBe(0);
  });

  it('step() reporta gols quando o placar de um time sobe', async () => {
    sim = new PhysicsSimulator({ cacheDir: fakeClientDir() });
    await sim.start();
    await sim.reset([null, { id: 1, team: 3 }, { id: 2, team: 2 }]);

    const result = await sim.step({ 1: 16 }); // bit 16 = action -> marca gol do time 2 no client falso
    expect(result.goals).toEqual([{ team: 2, scores: [0, 0, 1, 0, 0, 0], frame: 1 }]);
  });

  it('reset() rejeita antes de start()', async () => {
    sim = new PhysicsSimulator({ cacheDir: fakeClientDir() });
    await expect(sim.reset([])).rejects.toThrow(/não está pronto/);
  });
});
