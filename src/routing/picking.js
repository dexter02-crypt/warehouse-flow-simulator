import { validateWarehouse } from '../domain/warehouse.js';
import { validateSkus } from '../domain/sku.js';
import { validateOrders } from '../domain/orders.js';
import { validateAssignments } from '../domain/assignments.js';
import { createDistanceOracle, assertOracleCompatible, validateAlgorithm } from './search.js';
import { compareText } from '../common/validation.js';

/** Prevalidate a layout once; reuse the immutable distance cache across orders. */
export function createPickPlanner(warehouse, rows, assignments, { algorithm = 'astar', oracle = null } = {}) {
  const w = validateWarehouse(warehouse), skus = validateSkus(rows); validateAlgorithm(algorithm);
  const map = validateAssignments(w, skus, assignments), slots = new Map(w.slots.map(s => [s.id, s]));
  const dist = oracle ?? createDistanceOracle(w.grid, algorithm); assertOracleCompatible(dist, w.grid, algorithm);
  return order => {
    const clean = validateOrders([order], skus)[0], remaining = [...clean.skus], sequence = [], segments = [];
    let current = w.depot, totalCost = 0, totalSteps = 0;
    while (remaining.length) {
      let best = -1, bestCost = Infinity, bestSku = '';
      for (let i = 0; i < remaining.length; i++) {
        const sku = remaining[i], slot = slots.get(map.get(sku)), r = dist.get(current, slot.index);
        if (r.found && (r.cost < bestCost || (r.cost === bestCost && compareText(sku, bestSku) < 0))) {
          best = i; bestCost = r.cost; bestSku = sku;
        }
      }
      if (best < 0) throw new Error('No reachable next pick for this order.');
      const sku = remaining.splice(best, 1)[0], slot = slots.get(map.get(sku)), r = dist.get(current, slot.index);
      sequence.push(sku); segments.push({ from: current, to: slot.index, sku, cost: r.cost, path: r.path });
      totalCost += r.cost; totalSteps += r.path.length - 1; current = slot.index;
    }
    const back = dist.get(current, w.depot);
    if (!back.found) throw new Error('Cannot return to depot.');
    segments.push({ from: current, to: w.depot, sku: null, cost: back.cost, path: back.path });
    totalCost += back.cost; totalSteps += back.path.length - 1;
    return { orderId: clean.id, sequence, totalCost, totalSteps, segments };
  };
}
export function planPickSequence(warehouse, rows, order, assignments, options = {}) {
  return createPickPlanner(warehouse, rows, assignments, options)(order);
}
