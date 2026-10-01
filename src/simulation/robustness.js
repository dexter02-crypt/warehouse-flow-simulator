import { generateOrders, validateOrderConfig } from '../domain/orders.js';
import { compareLayouts, compareLayoutsAsync } from './compare.js';
import { integer, record, LIMITS } from '../common/validation.js';

export const DEFAULT_ROBUSTNESS_RUNS = 5;

export function validateRobustnessConfig(raw = {}) {
  record(raw, 'robustness settings');
  return {
    runs: integer(
      raw.runs === undefined ? DEFAULT_ROBUSTNESS_RUNS : raw.runs,
      'Robustness seeds',
      2,
      LIMITS.robustnessSeeds
    )
  };
}

function seedAt(startSeed, offset) {
  return (startSeed + offset) >>> 0;
}

function validateWork(settings, runs) {
  const totalOrders = settings.count * runs;
  if (totalOrders > LIMITS.robustnessOrders) {
    throw new Error(
      `Robustness analysis is limited to ${LIMITS.robustnessOrders} total sampled orders; ` +
      `reduce the order count or number of seeds.`
    );
  }
  return totalOrders;
}

function row(seed, comparison) {
  return {
    seed,
    algorithm: comparison.algorithm,
    beforeTotal: comparison.before.total,
    afterTotal: comparison.after.total,
    reduction: comparison.reduction,
    improved: comparison.improved,
    unchanged: comparison.unchanged,
    worsened: comparison.worsened
  };
}

function summarize(settings, perSeed) {
  const reductions = perSeed.map(x => x.reduction).sort((a, b) => a - b);
  const middle = Math.floor(reductions.length / 2);
  const medianReduction = reductions.length % 2
    ? reductions[middle]
    : (reductions[middle - 1] + reductions[middle]) / 2;

  const positiveSeeds = perSeed.filter(x => x.reduction > 0).length;
  const negativeSeeds = perSeed.filter(x => x.reduction < 0).length;
  const zeroSeeds = perSeed.length - positiveSeeds - negativeSeeds;

  return {
    algorithm: perSeed[0].algorithm,
    runs: perSeed.length,
    orderCount: settings.count,
    maxLines: settings.maxLines,
    totalOrders: settings.count * perSeed.length,
    startSeed: settings.seed,
    seeds: perSeed.map(x => x.seed),
    meanReduction: reductions.reduce((sum, value) => sum + value, 0) / reductions.length,
    medianReduction,
    minReduction: reductions[0],
    maxReduction: reductions.at(-1),
    positiveSeeds,
    zeroSeeds,
    negativeSeeds,
    perSeed
  };
}

export function analyzeRobustness(
  warehouse,
  rows,
  current,
  suggested,
  orderSettings = {},
  options = {}
) {
  const settings = validateOrderConfig(orderSettings);
  const { runs } = validateRobustnessConfig(options);
  const algorithm = options.algorithm ?? 'astar';

  validateWork(settings, runs);

  const perSeed = [];
  for (let i = 0; i < runs; i++) {
    const seed = seedAt(settings.seed, i);
    const orders = generateOrders(rows, { ...settings, seed });
    const comparison = compareLayouts(
      warehouse,
      rows,
      orders,
      current,
      suggested,
      { algorithm }
    );
    perSeed.push(row(seed, comparison));
  }

  return summarize(settings, perSeed);
}

export async function analyzeRobustnessAsync(
  warehouse,
  rows,
  current,
  suggested,
  orderSettings = {},
  options = {}
) {
  const settings = validateOrderConfig(orderSettings);
  const { runs } = validateRobustnessConfig(options);
  const algorithm = options.algorithm ?? 'astar';
  const yieldControl = options.yieldControl ??
    (() => new Promise(resolve => setTimeout(resolve, 0)));
  const onProgress = options.onProgress ?? (() => {});

  if (typeof yieldControl !== 'function' || typeof onProgress !== 'function') {
    throw new Error('Robustness callbacks must be functions.');
  }

  validateWork(settings, runs);

  const perSeed = [];
  for (let i = 0; i < runs; i++) {
    const seed = seedAt(settings.seed, i);
    const orders = generateOrders(rows, { ...settings, seed });

    const comparison = await compareLayoutsAsync(
      warehouse,
      rows,
      orders,
      current,
      suggested,
      {
        algorithm,
        yieldControl,
        onProgress: (ordersDone, orderCount) => onProgress({
          seed,
          seedIndex: i + 1,
          seedCount: runs,
          ordersDone,
          orderCount,
          complete: false
        })
      }
    );

    perSeed.push(row(seed, comparison));

    onProgress({
      seed,
      seedIndex: i + 1,
      seedCount: runs,
      ordersDone: settings.count,
      orderCount: settings.count,
      complete: true
    });

    if (i + 1 < runs) await yieldControl();
  }

  return summarize(settings, perSeed);
}
