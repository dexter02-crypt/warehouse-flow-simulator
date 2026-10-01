import { validateGrid, validateIndex } from '../routing/grid.js';
import { record, denseArray, text, positive, LIMITS } from '../common/validation.js';

export function validateWarehouse(raw) {
  record(raw, 'warehouse');
  const grid = validateGrid(raw.grid), depot = validateIndex(grid, raw.depot, true);
  denseArray(raw.slots, 'slots', 1, LIMITS.slots);
  const ids = new Set(), indexes = new Set();
  const slots = raw.slots.map((item, i) => {
    record(item, `slot ${i}`);
    const id = text(item.id, 'slot id', 40), index = validateIndex(grid, item.index, true);
    const zone = text(item.zone === undefined ? 'ambient' : item.zone, 'slot zone', 32);
    const capacity = positive(item.capacity === undefined ? 1 : item.capacity, 'slot capacity');
    const maxWeight = positive(item.maxWeight === undefined ? 1 : item.maxWeight, 'maximum slot weight');
    if (ids.has(id)) throw new Error(`Duplicate slot id: ${id}`);
    if (index === depot || indexes.has(index)) throw new Error(`Slot ${id} overlaps the depot or another slot.`);
    ids.add(id); indexes.add(index);
    return { id, index, zone, capacity, maxWeight };
  });
  return { grid, depot, slots };
}
export function slotMap(raw) { return new Map(validateWarehouse(raw).slots.map(s => [s.id, s])); }
