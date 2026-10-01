import { validateWarehouse } from '../domain/warehouse.js';
import { validateSkus } from '../domain/sku.js';
import { validateOrders } from '../domain/orders.js';
import { createDistanceOracle } from '../routing/search.js';
import { createPickPlanner } from '../routing/picking.js';
import { summarize } from './metrics.js';

function comparison(warehouse, rows, orders, current, suggested, algorithm) {
  const w = validateWarehouse(warehouse), skus = validateSkus(rows), clean = validateOrders(orders, skus);
  const oracle = createDistanceOracle(w.grid, algorithm);
  const beforePlanner = createPickPlanner(w, skus, current, { algorithm, oracle });
  const afterPlanner = createPickPlanner(w, skus, suggested, { algorithm, oracle });
  const perOrder = []; let improved = 0, unchanged = 0, worsened = 0, vertices = 0;
  return {
    count: clean.length,
    step(i) {
      const before = beforePlanner(clean[i]), after = afterPlanner(clean[i]), delta = after.totalCost - before.totalCost;
      vertices += before.totalSteps + before.segments.length + after.totalSteps + after.segments.length;
      if (vertices > 2_000_000) throw new Error('Result-size limit exceeded; reduce the number or length of orders.');
      if (delta < 0) improved++; else if (delta > 0) worsened++; else unchanged++;
      perOrder.push({ id: clean[i].id, before: before.totalCost, after: after.totalCost, delta, beforeRoute: before, afterRoute: after });
    },
    result() {
      const before = summarize(perOrder.map(x => x.before)), after = summarize(perOrder.map(x => x.after));
      return { algorithm, before, after, reduction: before.total ? 1 - after.total / before.total : 0,
        improved, unchanged, worsened, perOrder, oracleEntries: oracle.cacheSize() };
    }
  };
}
export function compareLayouts(warehouse, rows, orders, current, suggested, { algorithm = 'astar' } = {}) {
  const job = comparison(warehouse, rows, orders, current, suggested, algorithm);
  for (let i = 0; i < job.count; i++) job.step(i);
  return job.result();
}
/** Same calculations as the synchronous API, with browser event-loop yielding. */
export async function compareLayoutsAsync(warehouse, rows, orders, current, suggested,
  { algorithm = 'astar', yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)), onProgress = () => {} } = {}) {
  const job = comparison(warehouse, rows, orders, current, suggested, algorithm);
  for (let i = 0; i < job.count; i++) {
    job.step(i);
    if ((i + 1) % 50 === 0) { onProgress(i + 1, job.count); await yieldControl(); }
  }
  return job.result();
}
