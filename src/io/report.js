import { validateScenario } from './scenario.js';
import { validateOrders, validateOrderConfig, generateOrders, GENERATOR } from '../domain/orders.js';
import { validateAssignments } from '../domain/assignments.js';
import { compareLayouts } from '../simulation/compare.js';
import { validateAlgorithm } from '../routing/search.js';
import { record, boundedText, compareText, LIMITS } from '../common/validation.js';

export const ENGINE_VERSION = '1.0.1';
export const MODEL = 'orthogonal-entry-cost-nearest-next-v1';
function canonical(x, depth = 0) {
  if (depth > 32) throw new Error('Report nesting exceeds the supported limit.');
  if (x === null || typeof x === 'string' || typeof x === 'boolean') return JSON.stringify(x);
  if (typeof x === 'number' && Number.isFinite(x)) return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(v => canonical(v, depth + 1)).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort(compareText)
    .map(k => JSON.stringify(k) + ':' + canonical(x[k], depth + 1)).join(',') + '}';
  throw new Error('Report contains an unsupported value.');
}
function equal(a, b) { return canonical(a) === canonical(b); }
function assignmentObject(map) { return Object.fromEntries([...map].sort(([a], [b]) => compareText(a, b))); }
export function projectResult(report) {
  return { algorithm: report.algorithm, before: report.before, after: report.after, reduction: report.reduction,
    improved: report.improved, unchanged: report.unchanged, worsened: report.worsened,
    perOrder: report.perOrder.map(x => ({ id: x.id, before: x.before, after: x.after, delta: x.delta })),
    firstOrder: report.perOrder.length ? { before: report.perOrder[0].beforeRoute, after: report.perOrder[0].afterRoute } : null };
}
function normalizeInputs(raw) {
  record(raw, 'report');
  if (raw.format !== 'warehouse-flow-report' || raw.reportVersion !== 1 || raw.engineVersion !== ENGINE_VERSION || raw.model !== MODEL)
    throw new Error('Unsupported report format or engine version.');
  const scenario = validateScenario(raw.scenario), orders = validateOrders(raw.orders, scenario.skus);
  const algorithm = validateAlgorithm(raw.algorithm);
  record(raw.assignments, 'report assignments');
  const current = validateAssignments(scenario.warehouse, scenario.skus, raw.assignments.current);
  const suggested = validateAssignments(scenario.warehouse, scenario.skus, raw.assignments.suggested);
  const expectedCurrent = Object.fromEntries(scenario.skus.map(s => [s.sku, s.slotId]));
  if (!equal(assignmentObject(current), expectedCurrent)) throw new Error('Current assignments do not match the recorded scenario.');
  record(raw.orderConfig, 'order configuration');
  if (raw.orderConfig.source === 'generated') {
    const settings = validateOrderConfig(raw.orderConfig);
    if (raw.orderConfig.generator !== GENERATOR || scenario.orders !== null || !equal(generateOrders(scenario.skus, settings), orders))
      throw new Error('Recorded orders do not match the generator, seed and settings.');
  } else if (raw.orderConfig.source === 'scenario') {
    if (!scenario.orders || !equal(scenario.orders, orders)) throw new Error('Recorded orders do not match the supplied scenario orders.');
  } else throw new Error('Unknown order source.');
  return { scenario, orders, algorithm, current, suggested };
}
export function createReport({ scenario, orders, current, suggested, comparison, orderConfig, generatedAt = new Date().toISOString() }) {
  const capture = { format: 'warehouse-flow-report', reportVersion: 1, engineVersion: ENGINE_VERSION, model: MODEL,
    generatedAt, scenario: validateScenario(scenario), algorithm: comparison.algorithm, orderConfig: { ...orderConfig },
    orders: validateOrders(orders, scenario.skus),
    assignments: { current: assignmentObject(current), suggested: assignmentObject(suggested) }, result: projectResult(comparison) };
  normalizeInputs(capture);
  // Snapshot mutable caller data; no live reference can change an already completed export.
  return JSON.parse(canonical(capture));
}
export function serializeReport(report) {
  normalizeInputs(report);
  return boundedText(JSON.stringify(report, null, 2) + '\n', LIMITS.reportBytes, 'Report');
}
export function reproduceReport(value) {
  const raw = typeof value === 'string' ? JSON.parse(boundedText(value, LIMITS.reportBytes, 'Report')) : value;
  const { scenario, orders, algorithm, current, suggested } = normalizeInputs(raw);
  const actual = projectResult(compareLayouts(scenario.warehouse, scenario.skus, orders, current, suggested, { algorithm }));
  if (!equal(actual, raw.result)) throw new Error('Report mismatch: recomputed results differ from the exported results.');
  return { verified: true, engineVersion: ENGINE_VERSION, orders: orders.length, algorithm,
    beforeTotal: actual.before.total, afterTotal: actual.after.total, reduction: actual.reduction,
    improved: actual.improved, unchanged: actual.unchanged, worsened: actual.worsened };
}
