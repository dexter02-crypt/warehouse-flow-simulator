import { record, denseArray, integer } from '../common/validation.js';

export function validateGrid(raw) {
  record(raw, 'grid');
  const width = integer(raw.width, 'grid width', 2, 48);
  const height = integer(raw.height, 'grid height', 2, 32);
  denseArray(raw.cells, 'grid cells', width * height, width * height);
  if (raw.cells.some(v => ![0, 1, 3, 6].includes(v))) throw new Error('grid cells: use 0, 1, 3 or 6.');
  return { width, height, cells: [...raw.cells] };
}
export function validateIndex(grid, index, walkable = false) {
  integer(index, 'cell index', 0, grid.cells.length - 1);
  if (walkable && !grid.cells[index]) throw new Error('Cell must be walkable.');
  return index;
}
/** Private-to-the-algorithm helper: callers pass an already validated grid. */
export function adjacent(grid, index) {
  const { width: w, height: h, cells } = grid;
  const x = index % w, y = Math.floor(index / w), result = [];
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && cells[ny * w + nx]) result.push(ny * w + nx);
  }
  return result;
}
export function indexOf(raw, x, y) {
  const g = validateGrid(raw); integer(x, 'x', 0, g.width - 1); integer(y, 'y', 0, g.height - 1);
  return y * g.width + x;
}
export function coordsOf(raw, index) {
  const g = validateGrid(raw); validateIndex(g, index);
  return { x: index % g.width, y: Math.floor(index / g.width) };
}
export function neighbors(raw, index) {
  const g = validateGrid(raw); validateIndex(g, index, true); return adjacent(g, index);
}
export function pathCost(raw, path) {
  const g = validateGrid(raw); denseArray(path, 'path', 0, g.cells.length * 2);
  for (const i of path) validateIndex(g, i, true);
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    if (!adjacent(g, path[i - 1]).includes(path[i])) throw new Error('non-adjacent-path');
    cost += g.cells[path[i]];
  }
  return cost;
}
export function reachableCells(raw, start) {
  const g = validateGrid(raw); validateIndex(g, start, true);
  const seen = new Set([start]), queue = [start];
  for (let q = 0; q < queue.length; q++) for (const v of adjacent(g, queue[q])) {
    if (!seen.has(v)) { seen.add(v); queue.push(v); }
  }
  return seen;
}
