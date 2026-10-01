import { validateScenario } from './scenario.js';
import { validateOrderConfig, GENERATOR } from '../domain/orders.js';
import { validateAssignments } from '../domain/assignments.js';
import {
  analyzeRobustness,
  validateRobustnessConfig
} from '../simulation/robustness.js';
import { validateAlgorithm } from '../routing/search.js';
import {
  record,
  boundedText,
  compareText,
  LIMITS
} from '../common/validation.js';

export const ROBUSTNESS_ENGINE_VERSION = '1.1.0';
export const ROBUSTNESS_MODEL = 'orthogonal-entry-cost-nearest-next-v1';

function canonical(value, depth = 0) {
  if (depth > 32) {
    throw new Error('Robustness report nesting exceeds the supported limit.');
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(item => canonical(item, depth + 1)).join(',') + ']';
  }

  if (value && typeof value === 'object') {
    return '{' + Object.keys(value)
      .sort(compareText)
      .map(key => JSON.stringify(key) + ':' + canonical(value[key], depth + 1))
      .join(',') + '}';
  }

  throw new Error('Robustness report contains an unsupported value.');
}

function equal(a, b) {
  return canonical(a) === canonical(b);
}

function assignmentObject(map) {
  return Object.fromEntries(
    [...map].sort(([a], [b]) => compareText(a, b))
  );
}

export function projectRobustnessResult(result) {
  return {
    algorithm: result.algorithm,
    runs: result.runs,
    orderCount: result.orderCount,
    maxLines: result.maxLines,
    totalOrders: result.totalOrders,
    startSeed: result.startSeed,
    seeds: [...result.seeds],
    meanReduction: result.meanReduction,
    medianReduction: result.medianReduction,
    minReduction: result.minReduction,
    maxReduction: result.maxReduction,
    positiveSeeds: result.positiveSeeds,
    zeroSeeds: result.zeroSeeds,
    negativeSeeds: result.negativeSeeds,
    perSeed: result.perSeed.map(run => ({
      seed: run.seed,
      algorithm: run.algorithm,
      beforeTotal: run.beforeTotal,
      afterTotal: run.afterTotal,
      reduction: run.reduction,
      improved: run.improved,
      unchanged: run.unchanged,
      worsened: run.worsened
    }))
  };
}

function normalizeInputs(raw) {
  record(raw, 'robustness report');

  if (
    raw.format !== 'warehouse-flow-robustness-report' ||
    raw.reportVersion !== 1 ||
    raw.engineVersion !== ROBUSTNESS_ENGINE_VERSION ||
    raw.model !== ROBUSTNESS_MODEL
  ) {
    throw new Error('Unsupported robustness report format or engine version.');
  }

  const scenario = validateScenario(raw.scenario);

  if (scenario.orders !== null) {
    throw new Error(
      'Robustness reports require generated orders; a scenario with fixed orders has no seed sample to vary.'
    );
  }

  const algorithm = validateAlgorithm(raw.algorithm);

  record(raw.assignments, 'robustness report assignments');

  const current = validateAssignments(
    scenario.warehouse,
    scenario.skus,
    raw.assignments.current
  );

  const suggested = validateAssignments(
    scenario.warehouse,
    scenario.skus,
    raw.assignments.suggested
  );

  const expectedCurrent = Object.fromEntries(
    scenario.skus.map(sku => [sku.sku, sku.slotId])
  );

  if (!equal(assignmentObject(current), expectedCurrent)) {
    throw new Error(
      'Current assignments do not match the recorded scenario.'
    );
  }

  record(raw.orderConfig, 'robustness order configuration');

  if (
    raw.orderConfig.source !== 'generated' ||
    raw.orderConfig.generator !== GENERATOR
  ) {
    throw new Error(
      'Robustness reports require the recorded deterministic order generator.'
    );
  }

  const orderConfig = validateOrderConfig(raw.orderConfig);
  const robustnessConfig = validateRobustnessConfig(raw.robustnessConfig);

  return {
    scenario,
    algorithm,
    current,
    suggested,
    orderConfig,
    robustnessConfig
  };
}

export function createRobustnessReport({
  scenario,
  current,
  suggested,
  result,
  orderConfig,
  robustnessConfig,
  generatedAt = new Date().toISOString()
}) {
  const capture = {
    format: 'warehouse-flow-robustness-report',
    reportVersion: 1,
    engineVersion: ROBUSTNESS_ENGINE_VERSION,
    model: ROBUSTNESS_MODEL,
    generatedAt,
    scenario: validateScenario(scenario),
    algorithm: result.algorithm,
    orderConfig: {
      source: 'generated',
      generator: GENERATOR,
      ...orderConfig
    },
    robustnessConfig: {
      ...robustnessConfig
    },
    assignments: {
      current: assignmentObject(current),
      suggested: assignmentObject(suggested)
    },
    result: projectRobustnessResult(result)
  };

  normalizeInputs(capture);

  return JSON.parse(canonical(capture));
}

export function serializeRobustnessReport(report) {
  normalizeInputs(report);

  return boundedText(
    JSON.stringify(report, null, 2) + '\n',
    LIMITS.reportBytes,
    'Robustness report'
  );
}

export function reproduceRobustnessReport(value) {
  const raw = typeof value === 'string'
    ? JSON.parse(
        boundedText(
          value,
          LIMITS.reportBytes,
          'Robustness report'
        )
      )
    : value;

  const {
    scenario,
    algorithm,
    current,
    suggested,
    orderConfig,
    robustnessConfig
  } = normalizeInputs(raw);

  const actual = projectRobustnessResult(
    analyzeRobustness(
      scenario.warehouse,
      scenario.skus,
      current,
      suggested,
      orderConfig,
      {
        ...robustnessConfig,
        algorithm
      }
    )
  );

  if (!equal(actual, raw.result)) {
    throw new Error(
      'Robustness report mismatch: recomputed results differ from the exported results.'
    );
  }

  return {
    verified: true,
    engineVersion: raw.engineVersion,
    algorithm,
    runs: actual.runs,
    totalOrders: actual.totalOrders,
    meanReduction: actual.meanReduction,
    medianReduction: actual.medianReduction,
    minReduction: actual.minReduction,
    maxReduction: actual.maxReduction,
    positiveSeeds: actual.positiveSeeds,
    zeroSeeds: actual.zeroSeeds,
    negativeSeeds: actual.negativeSeeds
  };
}
