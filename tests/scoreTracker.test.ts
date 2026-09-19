import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { ScoreTracker, winnerOf } from '../src/score/ScoreTracker.js';
import { SIM_WORKER_SOURCE } from '../src/score/simWorker.js';

describe('winnerOf', () => {
  it('devolve o time que chegou ao limite', () => {
    expect(winnerOf([0, 0, 1, 3], 3)).toBe(3);
    expect(winnerOf([0, 0, 3, 2], 3)).toBe(2);
  });
  it('devolve null antes do limite', () => {
    expect(winnerOf([0, 0, 2, 2], 3)).toBeNull();
    expect(winnerOf([], 3)).toBeNull();
  });
});

describe('ScoreTracker', () => {
  it('o código do worker é JavaScript válido', () => {
    expect(() => new Function(SIM_WORKER_SOURCE)).not.toThrow();
  });

  it('ignora partidas que não são football e não falha sem simulador', () => {
    const room = new EventEmitter();
    const tracker = new ScoreTracker(room as never, { cacheDir: '.' });
    expect(tracker.ready).toBe(false);
    expect(tracker.tracking).toBe(false);
    room.emit('game-start', { is: 'x', gs: { ga: 'b' } });
    expect(tracker.tracking).toBe(false);
  });
});
