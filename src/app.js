import { parseScenario, serializeScenario } from './io/scenario.js';
import { createReport, serializeReport } from './io/report.js';
import { classifySkus } from './domain/sku.js';
import { generateOrders, validateOrderConfig, GENERATOR } from './domain/orders.js';
import { currentAssignments, optimizeSlotting } from './slotting/optimizer.js';
import { compareLayoutsAsync } from './simulation/compare.js';
import { LIMITS } from './common/validation.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
let scenario = null, optimized = null, lastReport = null, busy = false;
const controls = ['orderCount', 'maxLines', 'seed', 'algorithm'];
function message(text, kind = '') { $('status').textContent = text; $('status').className = 'status ' + kind; }
function clearResults(text = 'Settings changed. Run again to calculate current results.') {
  lastReport = null; $('exportReport').disabled = true;
  for (const id of ['avg', 'median', 'p95', 'reduction', 'outcomes']) $(id).textContent = '—';
  $('reduction').className = 'metric'; $('orderTable').replaceChildren(); $('replayMap').replaceChildren();
  $('replayText').textContent = 'No completed result for the current settings.'; message(text);
}
function setBusy(value) {
  busy = value; $('run').disabled = value || !scenario; $('reload').disabled = value;
  for (const id of controls) $(id).disabled = value || (!!scenario?.orders && id !== 'algorithm');
}
function download(name, value) {
  const blob = new Blob([value], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function element(tag, attributes, text = '') {
  const el = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, String(value));
  if (text) el.textContent = text;
  return el;
}
function renderMap(svg, warehouse, skus, assignments, route = null) {
  const { grid, depot, slots } = warehouse, w = grid.width, cellW = 900 / w, cellH = 600 / grid.height;
  const bySlot = new Map(skus.map(s => [assignments.get(s.sku), s.sku])), fragment = document.createDocumentFragment();
  for (let i = 0; i < grid.cells.length; i++) fragment.append(element('rect', {
    x: (i % w) * cellW + 1, y: Math.floor(i / w) * cellH + 1,
    width: cellW - 2, height: cellH - 2, rx: 5, fill: grid.cells[i] ? '#23364d' : '#0d121a'
  }));
  if (route) {
    const points = route.segments.flatMap(seg => seg.path.map(i => `${i % w * cellW + cellW / 2},${Math.floor(i / w) * cellH + cellH / 2}`));
    fragment.append(element('polyline', { points: points.join(' '), fill: 'none', stroke: '#7ee2b8',
      'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 }));
  }
  for (const slot of slots) {
    const x = slot.index % w * cellW, y = Math.floor(slot.index / w) * cellH;
    fragment.append(element('rect', { x: x + 5, y: y + 5, width: cellW - 10, height: cellH - 10,
      rx: 7, fill: slot.zone === 'cold' ? '#b99cff' : '#8ad7ff' }));
    fragment.append(element('text', { x: x + cellW / 2, y: y + cellH / 2 + 4,
      'text-anchor': 'middle', 'font-size': 12, fill: '#07111d' }, bySlot.get(slot.id) ?? slot.id));
  }
  const dx = depot % w * cellW + cellW / 2, dy = Math.floor(depot / w) * cellH + cellH / 2;
  fragment.append(element('circle', { cx: dx, cy: dy, r: Math.min(cellW, cellH) * 0.3, fill: '#ffd27d' }));
  fragment.append(element('text', { x: dx, y: dy + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#07111d' }, 'D'));
  svg.replaceChildren(fragment);
}
function renderRows(body, rows) {
  const fragment = document.createDocumentFragment();
  for (const row of rows) { const tr = document.createElement('tr'); for (const value of row) {
    const td = document.createElement('td'); td.textContent = String(value); tr.append(td);
  } fragment.append(tr); }
  body.replaceChildren(fragment);
}
function renderStatic() {
  const cls = classifySkus(scenario.skus), curr = currentAssignments(scenario.skus), details = new Map(cls.map(s => [s.sku, s]));
  $('scenarioName').textContent = scenario.name;
  $('scenarioStats').textContent = `${scenario.warehouse.grid.width}×${scenario.warehouse.grid.height} grid · ${scenario.warehouse.slots.length} slots · ${scenario.skus.length} SKUs`;
  $('scenarioScope').textContent = 'Slots are walkable pick-access points, not solid shelf footprints. One SKU per slot; capacity, weight, zone and depot reachability are checked.';
  renderMap($('currentMap'), scenario.warehouse, scenario.skus, curr);
  renderMap($('suggestedMap'), scenario.warehouse, scenario.skus, optimized.assignments);
  for (const c of ['A', 'B', 'C']) $(c.toLowerCase() + 'Count').textContent = cls.filter(s => s.abc === c).length;
  renderRows($('slotTable'), optimized.details.map(d => [d.sku, d.abc + d.xyz, details.get(d.sku).slotId, d.slotId, d.distance]));
  $('slottingNote').textContent = optimized.repairUsed ? 'A feasibility reassignment was required. This is not a global cost optimum.' : 'Activity-first feasible assignment. Lower total picking cost is not guaranteed.';
  if (scenario.orders) { $('orderCount').value = scenario.orders.length; $('orderSource').textContent = 'Using the exact orders embedded in this scenario; generator controls are disabled.'; }
  else $('orderSource').textContent = 'Same seeded order list before and after. Seed 0 is supported; zero-demand SKUs are excluded unless all demand is zero.';
  $('exportScenario').disabled = false;
}
function controlInteger(id, name) {
  const value = $(id).value.trim(); if (!value) throw new Error(`${name} cannot be empty.`);
  return Number(value);
}
async function runSimulation() {
  if (busy || !scenario) return;
  clearResults('Validating settings…'); setBusy(true);
  try {
    const algorithm = $('algorithm').value;
    const settings = scenario.orders ? null : validateOrderConfig({ count: controlInteger('orderCount', 'Orders'),
      seed: controlInteger('seed', 'Seed'), maxLines: controlInteger('maxLines', 'Max lines') });
    const orders = scenario.orders ?? generateOrders(scenario.skus, settings);
    const curr = currentAssignments(scenario.skus);
    // Keep the chosen pathfinder and the recorded slotting engine consistent.
    optimized = optimizeSlotting(scenario.warehouse, scenario.skus, { algorithm }); renderStatic();
    const comparison = await compareLayoutsAsync(scenario.warehouse, scenario.skus, orders, curr, optimized.assignments, {
      algorithm, onProgress: (n, total) => message(`Calculating order ${n} of ${total}…`)
    });
    const orderConfig = scenario.orders ? { source: 'scenario' } : { source: 'generated', generator: GENERATOR, ...settings };
    const capture = createReport({ scenario, orders, current: curr, suggested: optimized.assignments, comparison, orderConfig });
    // Check export size now, not after showing a result that cannot be reproduced.
    serializeReport(capture);
    $('avg').textContent = `${comparison.before.mean.toFixed(1)} → ${comparison.after.mean.toFixed(1)}`;
    $('median').textContent = `${comparison.before.median.toFixed(1)} → ${comparison.after.median.toFixed(1)}`;
    $('p95').textContent = `${comparison.before.p95.toFixed(1)} → ${comparison.after.p95.toFixed(1)}`;
    $('reduction').textContent = `${(100 * comparison.reduction).toFixed(1)}%`;
    $('reduction').className = 'metric ' + (comparison.reduction < 0 ? 'warning' : 'good');
    $('outcomes').textContent = `${comparison.improved} · ${comparison.unchanged} · ${comparison.worsened}`;
    renderRows($('orderTable'), comparison.perOrder.slice(0, 10).map((r, i) => [r.id, orders[i].skus.join(', '), r.before, r.after, r.delta]));
    const first = comparison.perOrder[0];
    $('replayText').textContent = `${first.id}: ${first.afterRoute.sequence.join(' → ')} → depot · cost ${first.after}`;
    renderMap($('replayMap'), scenario.warehouse, scenario.skus, optimized.assignments, first.afterRoute);
    lastReport = capture; $('exportReport').disabled = false;
    message(`Completed ${orders.length} orders with ${algorithm}. Export includes the scenario, exact orders, assignments and results.`, 'success');
  } catch (error) { clearResults(`Simulation stopped: ${error.message || String(error)}`); $('status').className = 'status error'; }
  finally { setBusy(false); }
}
async function loadScenario() {
  if (busy) return;
  clearResults('Loading and validating scenario…'); scenario = null; optimized = null;
  $('exportScenario').disabled = true; setBusy(true);
  for (const id of ['currentMap', 'suggestedMap', 'slotTable']) $(id).replaceChildren();
  for (const id of ['scenarioName', 'scenarioStats', 'aCount', 'bCount', 'cCount', 'slottingNote', 'orderSource']) $(id).textContent = '—';
  try {
    const response = await fetch('./examples/warehouse-scenario.json');
    if (!response.ok) throw new Error(`Scenario request failed (HTTP ${response.status}).`);
    const length = Number(response.headers.get('Content-Length'));
    if (length > LIMITS.scenarioBytes) throw new Error('Scenario exceeds the 1 MiB limit.');
    const next = parseScenario(await response.text());
    const proposal = optimizeSlotting(next.warehouse, next.skus, { algorithm: $('algorithm').value });
    scenario = next; optimized = proposal; renderStatic();
  } catch (error) { scenario = null; message(`Cannot load scenario: ${error.message || String(error)} Use Reload scenario after correcting it.`, 'error'); }
  finally { setBusy(false); }
  if (scenario) await runSimulation();
}
$('run').onclick = runSimulation;
$('reload').onclick = loadScenario;
for (const id of controls) { $(id).addEventListener('input', () => clearResults()); $(id).addEventListener('change', () => clearResults()); }
$('exportReport').onclick = () => {
  if (!lastReport) return;
  try { download('warehouse-flow-report.json', serializeReport(lastReport)); }
  catch (e) { clearResults(`Export failed: ${e.message}`); }
};
$('exportScenario').onclick = () => {
  if (!scenario) return;
  try { download('warehouse-flow-scenario.json', serializeScenario(scenario)); }
  catch (e) { message(`Export failed: ${e.message}`, 'error'); }
};
loadScenario();
