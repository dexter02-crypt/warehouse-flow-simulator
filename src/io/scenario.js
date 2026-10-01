import { validateWarehouse } from '../domain/warehouse.js';
import { validateSkus } from '../domain/sku.js';
import { validateOrders } from '../domain/orders.js';
import { validateAssignments } from '../domain/assignments.js';
import { record, boundedText, LIMITS } from '../common/validation.js';

export function validateScenario(raw) {
  record(raw, 'scenario'); if (raw.version !== 1) throw new Error('scenario-version: expected 1.');
  const warehouse = validateWarehouse(raw.warehouse), skus = validateSkus(raw.skus);
  validateAssignments(warehouse, skus, new Map(skus.map(s => [s.sku, s.slotId])));
  const orders = raw.orders == null ? null : validateOrders(raw.orders, skus);
  const name = raw.name === undefined ? 'Warehouse Flow Scenario' : raw.name;
  if (typeof name !== 'string') throw new Error('Scenario name must be text.');
  return { version: 1, name: name.slice(0, 120), warehouse, skus, orders };
}
export function serializeScenario(raw) {
  const out = JSON.stringify(validateScenario(raw), null, 2) + '\n';
  return boundedText(out, LIMITS.scenarioBytes, 'Scenario');
}
export function parseScenario(value) {
  return validateScenario(JSON.parse(boundedText(value, LIMITS.scenarioBytes, 'Scenario')));
}
