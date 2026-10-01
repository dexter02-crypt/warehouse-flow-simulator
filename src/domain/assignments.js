import { validateWarehouse } from './warehouse.js';
import { validateSkus } from './sku.js';
import { reachableCells } from '../routing/grid.js';
import { compatibleSkuSlot } from '../slotting/constraints.js';
import { text } from '../common/validation.js';

/** One SKU per slot; every assigned slot must be compatible and reachable. */
export function validateAssignments(warehouse, rows, input) {
  const w = validateWarehouse(warehouse), skus = validateSkus(rows);
  const slots = new Map(w.slots.map(s => [s.id, s]));
  let entries;
  if (input instanceof Map) entries = [...input];
  else if (input && typeof input === 'object' && !Array.isArray(input) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(input))) entries = Object.entries(input);
  else throw new Error('assignments: expected a Map or an object.');
  const known = new Set(skus.map(s => s.sku)), map = new Map();
  for (const [key, val] of entries) {
    const sku = text(key, 'assigned SKU'), slotId = text(val, 'assigned slot', 40);
    if (!known.has(sku) || map.has(sku)) throw new Error(`Unknown or duplicate assigned SKU: ${sku}`);
    map.set(sku, slotId);
  }
  if (map.size !== skus.length) throw new Error('assignments: every SKU must have exactly one slot.');
  const occupied = new Set(), reachable = reachableCells(w.grid, w.depot);
  for (const sku of skus) {
    const id = map.get(sku.sku), slot = slots.get(id);
    if (!slot) throw new Error(`Unknown slot ${id} for SKU ${sku.sku}.`);
    if (occupied.has(id)) throw new Error(`Slot ${id} is assigned to more than one SKU.`);
    if (!compatibleSkuSlot(sku, slot)) throw new Error(`SKU ${sku.sku} does not fit the capacity, weight or zone of slot ${id}.`);
    if (!reachable.has(slot.index)) throw new Error(`Slot ${id} for SKU ${sku.sku} is unreachable from the depot.`);
    occupied.add(id);
  }
  return map;
}
