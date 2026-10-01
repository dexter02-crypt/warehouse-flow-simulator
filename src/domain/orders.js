import { validateSkus } from './sku.js';
import { record, denseArray, text, integer, LIMITS } from '../common/validation.js';

export const GENERATOR = 'lcg-rejection-with-completion-v1';
export function validateOrderConfig(raw = {}) {
  record(raw, 'order settings');
  return { count: integer(raw.count === undefined ? 1000 : raw.count, 'Orders', 1, LIMITS.orders),
    seed: integer(raw.seed === undefined ? 42 : raw.seed, 'Seed', 0, 0xffffffff),
    maxLines: integer(raw.maxLines === undefined ? 5 : raw.maxLines, 'Max lines per order', 1, LIMITS.lines) };
}
function rng(seed) { let x = seed; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
function weightedPick(pool, random, spend) {
  spend(pool.length);
  const total = pool.reduce((s, x) => s + x.picksPerDay, 0);
  if (!total) return pool[Math.floor(random() * pool.length)];
  let r = random() * total;
  for (const x of pool) { spend(); r -= x.picksPerDay; if (r <= 0) return x; }
  return pool.at(-1);
}
export function generateOrders(rows, settings = {}) {
  const skus = validateSkus(rows), { count, seed, maxLines } = validateOrderConfig(settings);
  // Zero-frequency SKUs are not sampled unless the entire demand model is zero.
  const positive = skus.filter(x => x.picksPerDay > 0), pool = positive.length ? positive : skus;
  const random = rng(seed), orders = [];
  let work = 0;
  const spend = (n = 1) => {
    work += n;
    if (work > LIMITS.generatorWork) throw new Error('Order-generation work limit exceeded; use fewer orders or less skewed demand. No shortened order list was returned.');
  };
  for (let i = 0; i < count; i++) {
    const target = 1 + Math.floor(random() * Math.min(maxLines, pool.length)), selected = new Set();
    let attempts = 0;
    while (selected.size < target && attempts++ < 1000) selected.add(weightedPick(pool, random, spend).sku);
    // Preserve the old stream for ordinary inputs, but never silently truncate an order.
    while (selected.size < target) {
      spend(pool.length);
      const remaining = pool.filter(s => !selected.has(s.sku));
      selected.add(weightedPick(remaining, random, spend).sku);
    }
    orders.push({ id: `O${String(i + 1).padStart(5, '0')}`, skus: [...selected] });
  }
  return orders;
}
export function validateOrders(orders, rows) {
  const known = new Set(validateSkus(rows).map(s => s.sku)), ids = new Set();
  denseArray(orders, 'orders', 1, LIMITS.orders);
  return orders.map((raw, i) => {
    record(raw, `order ${i}`); const id = text(raw.id, 'order id');
    if (ids.has(id)) throw new Error(`Duplicate order id: ${id}`); ids.add(id);
    denseArray(raw.skus, `order ${id} lines`, 1, LIMITS.lines);
    const skus = raw.skus.map(v => text(v, 'ordered SKU'));
    if (new Set(skus).size !== skus.length || skus.some(s => !known.has(s))) throw new Error(`Unknown or duplicate SKU in order ${id}.`);
    return { id, skus };
  });
}
