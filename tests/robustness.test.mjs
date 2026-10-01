import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ROBUSTNESS_RUNS,
  analyzeRobustness,
  analyzeRobustnessAsync,
  validateRobustnessConfig
} from '../src/simulation/robustness.js';

const grid = { width: 5, height: 3, cells: Array(15).fill(1) };

const warehouse = {
  grid,
  depot: 10,
  slots: [
    { id: 'N', index: 11, zone: 'ambient', capacity: 4, maxWeight: 10 },
    { id: 'M', index: 7, zone: 'ambient', capacity: 4, maxWeight: 10 },
    { id: 'F', index: 4, zone: 'ambient', capacity: 4, maxWeight: 10 }
  ]
};

const skus = [
  { sku: 'A', picksPerDay: 100, size: 1, weight: 1, zone: 'ambient', demandCV: .2, slotId: 'F' },
  { sku: 'B', picksPerDay: 50, size: 1, weight: 1, zone: 'ambient', demandCV: .6, slotId: 'M' }
];

const current = new Map([
  ['A', 'F'],
  ['B', 'M']
]);

const suggested = new Map([
  ['A', 'N'],
  ['B', 'M']
]);

const settings = { count: 12, seed: 42, maxLines: 2 };

test('robustness defaults to five seeds', () => {
  assert.equal(validateRobustnessConfig().runs, DEFAULT_ROBUSTNESS_RUNS);
  assert.equal(DEFAULT_ROBUSTNESS_RUNS, 5);
});

test('robustness seed count must be an integer within bounds', () => {
  assert.throws(() => validateRobustnessConfig({ runs: 1 }));
  assert.throws(() => validateRobustnessConfig({ runs: 21 }));
  assert.throws(() => validateRobustnessConfig({ runs: 2.5 }));
  assert.equal(validateRobustnessConfig({ runs: 20 }).runs, 20);
});

test('analysis uses consecutive deterministic seeds', () => {
  const result = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 4 }
  );
  assert.deepEqual(result.seeds, [42, 43, 44, 45]);
});

test('seed sequence wraps deterministically at uint32 maximum', () => {
  const result = analyzeRobustness(
    warehouse,
    skus,
    current,
    suggested,
    { ...settings, seed: 0xffffffff },
    { runs: 3 }
  );
  assert.deepEqual(result.seeds, [0xffffffff, 0, 1]);
});

test('analysis is deterministic for identical inputs', () => {
  const first = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 5 }
  );
  const second = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 5 }
  );
  assert.deepEqual(first, second);
});

test('summary accounts for every seed and sampled order', () => {
  const result = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 5 }
  );
  assert.equal(result.runs, 5);
  assert.equal(result.totalOrders, 60);
  assert.equal(
    result.positiveSeeds + result.zeroSeeds + result.negativeSeeds,
    result.runs
  );
  assert.equal(result.perSeed.length, result.runs);
});

test('per-seed outcomes account for every order', () => {
  const result = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 4 }
  );
  for (const run of result.perSeed) {
    assert.equal(run.improved + run.unchanged + run.worsened, settings.count);
  }
});

test('summary reduction bounds contain the median and mean', () => {
  const result = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 5 }
  );
  assert.ok(result.minReduction <= result.medianReduction);
  assert.ok(result.medianReduction <= result.maxReduction);
  assert.ok(result.minReduction <= result.meanReduction);
  assert.ok(result.meanReduction <= result.maxReduction);
});

test('oversized seed-by-order workloads are rejected before analysis', () => {
  assert.throws(
    () => analyzeRobustness(
      warehouse,
      skus,
      current,
      suggested,
      { count: 10000, seed: 1, maxLines: 2 },
      { runs: 3 }
    ),
    /20000 total sampled orders/
  );
});

test('async analysis produces the same result as synchronous analysis', async () => {
  const expected = analyzeRobustness(
    warehouse, skus, current, suggested, settings, { runs: 3 }
  );

  const actual = await analyzeRobustnessAsync(
    warehouse,
    skus,
    current,
    suggested,
    settings,
    {
      runs: 3,
      yieldControl: async () => {}
    }
  );

  assert.deepEqual(actual, expected);
});

test('async progress reports completion for every seed', async () => {
  const progress = [];

  await analyzeRobustnessAsync(
    warehouse,
    skus,
    current,
    suggested,
    settings,
    {
      runs: 3,
      yieldControl: async () => {},
      onProgress: event => progress.push(event)
    }
  );

  const completed = progress.filter(event => event.complete);
  assert.equal(completed.length, 3);
  assert.deepEqual(completed.map(event => event.seed), [42, 43, 44]);
  assert.ok(completed.every(event => event.ordersDone === settings.count));
});

test('A* and Dijkstra produce the same per-seed modeled totals', () => {
  const astar = analyzeRobustness(
    warehouse, skus, current, suggested, settings,
    { runs: 4, algorithm: 'astar' }
  );

  const dijkstra = analyzeRobustness(
    warehouse, skus, current, suggested, settings,
    { runs: 4, algorithm: 'dijkstra' }
  );

  assert.deepEqual(
    astar.perSeed.map(x => [x.seed, x.beforeTotal, x.afterTotal]),
    dijkstra.perSeed.map(x => [x.seed, x.beforeTotal, x.afterTotal])
  );
});

test('invalid robustness callbacks are rejected', async () => {
  await assert.rejects(
    analyzeRobustnessAsync(
      warehouse,
      skus,
      current,
      suggested,
      settings,
      { runs: 2, onProgress: true }
    ),
    /callbacks must be functions/
  );
});
