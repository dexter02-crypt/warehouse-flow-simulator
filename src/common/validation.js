/** Explicit model bounds. Values are numbers, not coercible strings or booleans. */
export const LIMITS = Object.freeze({ skus: 5000, slots: 500, orders: 10000, lines: 25,
  robustnessSeeds: 20, robustnessOrders: 20_000,
  quantity: 1e9, scenarioBytes: 1024 * 1024, reportBytes: 16 * 1024 * 1024,
  simulationWork: 20_000_000, matchingWork: 10_000_000, generatorWork: 20_000_000 });
export function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name}: expected an object.`);
  return value;
}
export function text(value, name, max = 64) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/u.test(value))
    throw new Error(`${name}: expected nonempty text of at most ${max} characters.`);
  return value.trim();
}
export function number(value, name, min = 0, max = LIMITS.quantity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name}: expected a finite number from ${min} to ${max}.`);
  return value;
}
export function positive(value, name) {
  number(value, name); if (value <= 0) throw new Error(`${name}: must be positive.`); return value;
}
export function integer(value, name, min, max) {
  number(value, name, min, max); if (!Number.isInteger(value)) throw new Error(`${name}: expected an integer.`); return value;
}
export function denseArray(value, name, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error(`${name}: expected ${min}–${max} entries.`);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw new Error(`${name}: sparse arrays are not supported.`);
  return value;
}
export function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
export function boundedText(value, max, name) {
  if (typeof value !== 'string' || value.length > max || new TextEncoder().encode(value).length > max)
    throw new Error(`${name}: text is missing or exceeds ${max} bytes.`);
  return value;
}
