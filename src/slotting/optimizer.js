import { validateWarehouse } from '../domain/warehouse.js';
import { classifySkus, validateSkus } from '../domain/sku.js';
import { compatibleSkuSlot } from './constraints.js';
import { createDistanceOracle } from '../routing/search.js';
import { compareText, LIMITS } from '../common/validation.js';

export function currentAssignments(rows) { return new Map(validateSkus(rows).map(s => [s.sku, s.slotId])); }
export function optimizeSlotting(warehouse, rows, { algorithm = 'astar' } = {}) {
  const w = validateWarehouse(warehouse), skus = classifySkus(rows);
  if (skus.length > w.slots.length) throw new Error('Not enough slots for a one-SKU-per-slot assignment.');
  const oracle = createDistanceOracle(w.grid, algorithm);
  const ranked = w.slots.map(slot => {
    const r = oracle.get(w.depot, slot.index); return { ...slot, distance: r.found ? r.cost : Infinity };
  }).filter(s => Number.isFinite(s.distance)).sort((a, b) => a.distance - b.distance || compareText(a.id, b.id));
  const edges = skus.map(sku => ranked.map((slot, j) => compatibleSkuSlot(sku, slot) ? j : -1).filter(j => j >= 0));
  const owner = new Int32Array(ranked.length).fill(-1), slotFor = new Int32Array(skus.length).fill(-1);
  let repairUsed = false, work = 0;
  for (let i = 0; i < skus.length; i++) {
    // Keep the historical greedy result when it yields a complete feasible allocation.
    const free = edges[i].find(j => owner[j] === -1);
    if (free !== undefined) { owner[free] = i; slotFor[i] = free; continue; }
    repairUsed = true;
    // Find an augmenting path, moving previous choices only when needed for feasibility.
    const parent = new Int32Array(ranked.length).fill(-1), seen = new Set([i]), queue = [i];
    let end = -1;
    for (let q = 0; q < queue.length && end < 0; q++) for (const j of edges[queue[q]]) {
      if (++work > LIMITS.matchingWork) throw new Error('Slot-assignment work limit exceeded; feasibility was not decided.');
      if (parent[j] >= 0) continue;
      parent[j] = queue[q];
      if (owner[j] < 0) { end = j; break; }
      if (!seen.has(owner[j])) { seen.add(owner[j]); queue.push(owner[j]); }
    }
    if (end < 0) throw new Error(`No complete compatible reachable slot assignment exists (blocked at ${skus[i].sku}).`);
    while (end >= 0) {
      const k = parent[end], previous = slotFor[k]; owner[end] = k; slotFor[k] = end; end = previous;
    }
  }
  const assignments = new Map(), details = skus.map((sku, i) => {
    const slot = ranked[slotFor[i]]; assignments.set(sku.sku, slot.id);
    return { sku: sku.sku, abc: sku.abc, xyz: sku.xyz, slotId: slot.id, distance: slot.distance };
  });
  return { assignments, details, algorithm, repairUsed };
}
