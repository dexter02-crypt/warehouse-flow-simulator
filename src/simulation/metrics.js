import { denseArray, number, LIMITS } from '../common/validation.js';
function values(input) {
  denseArray(input, 'metric values', 1, LIMITS.orders);
  input.forEach(x => number(x, 'route cost', 0, 1e9)); return [...input].sort((a, b) => a - b);
}
export function mean(input) { values(input); return input.reduce((a, b) => a + b, 0) / input.length; }
export function median(input) { const x = values(input), m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }
export function percentile(input, p) { const x = values(input); number(p, 'percentile', 0, 1); return x[Math.max(0, Math.ceil(p * x.length) - 1)]; }
export function summarize(input) {
  const x = values(input), total = x.reduce((a, b) => a + b, 0), n = x.length, m = Math.floor(n / 2);
  return { count: n, total, mean: total / n, median: n % 2 ? x[m] : (x[m - 1] + x[m]) / 2,
    p95: x[Math.max(0, Math.ceil(0.95 * n) - 1)], min: x[0], max: x[n - 1] };
}
