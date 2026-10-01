import fs from 'node:fs';
import { parseScenario } from '../src/io/scenario.js';
import { generateOrders, GENERATOR } from '../src/domain/orders.js';
import { currentAssignments, optimizeSlotting } from '../src/slotting/optimizer.js';
import { compareLayouts } from '../src/simulation/compare.js';
import { createReport, reproduceReport } from '../src/io/report.js';
const scenario = parseScenario(fs.readFileSync(new URL('../examples/warehouse-scenario.json', import.meta.url), 'utf8'));
const config = { count: 1000, seed: 42, maxLines: 5 };
const current = currentAssignments(scenario.skus), suggested = optimizeSlotting(scenario.warehouse, scenario.skus).assignments;
const orders = generateOrders(scenario.skus, config), comparison = compareLayouts(scenario.warehouse, scenario.skus, orders, current, suggested);
const report = createReport({ scenario, orders, current, suggested, comparison,
  orderConfig: { source: 'generated', generator: GENERATOR, ...config }, generatedAt: '2026-10-01T00:00:00.000Z' });
console.log(JSON.stringify(reproduceReport(report), null, 2));
