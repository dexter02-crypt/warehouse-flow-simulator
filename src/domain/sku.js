import { record, denseArray, text, number, positive, compareText, LIMITS } from '../common/validation.js';

export function validateSkus(rows) {
  denseArray(rows, 'skus', 1, LIMITS.skus); const ids = new Set();
  return rows.map((raw, i) => {
    record(raw, `SKU ${i}`);
    const sku = text(raw.sku, 'SKU id'), slotId = text(raw.slotId, 'current slot id', 40);
    if (ids.has(sku)) throw new Error(`Duplicate SKU: ${sku}`); ids.add(sku);
    const picksPerDay = number(raw.picksPerDay, 'picks per day');
    const size = positive(raw.size === undefined ? 1 : raw.size, 'SKU size');
    const weight = positive(raw.weight === undefined ? 1 : raw.weight, 'SKU weight');
    const zone = text(raw.zone === undefined ? 'ambient' : raw.zone, 'SKU zone', 32);
    const demandCV = number(raw.demandCV === undefined ? 0.25 : raw.demandCV, 'demand CV');
    return { sku, picksPerDay, size, weight, zone, demandCV, slotId };
  });
}
export function classifyABC(rows) {
  const skus = validateSkus(rows).sort((a, b) => b.picksPerDay - a.picksPerDay || compareText(a.sku, b.sku));
  const total = skus.reduce((s, x) => s + x.picksPerDay, 0); let cum = 0;
  return skus.map(x => {
    const before = total ? cum / total : 0; cum += x.picksPerDay;
    return { ...x, abc: !total || !x.picksPerDay ? 'C' : before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C',
      cumulativeShare: total ? cum / total : 0 };
  });
}
export function xyzClass(cv) { number(cv, 'demand CV'); return cv <= 0.5 ? 'X' : cv <= 1 ? 'Y' : 'Z'; }
export function classifySkus(rows) { return classifyABC(rows).map(x => ({ ...x, xyz: xyzClass(x.demandCV) })); }
