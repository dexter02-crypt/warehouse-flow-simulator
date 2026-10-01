import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateScenario, parseScenario } from '../src/io/scenario.js';
import { validateGrid, pathCost } from '../src/routing/grid.js';
import { validateWarehouse } from '../src/domain/warehouse.js';
import { validateSkus, classifyABC } from '../src/domain/sku.js';
import { generateOrders, validateOrderConfig, validateOrders, GENERATOR } from '../src/domain/orders.js';
import { validateAssignments } from '../src/domain/assignments.js';
import { optimizeSlotting, currentAssignments } from '../src/slotting/optimizer.js';
import { createDistanceOracle, shortestPath } from '../src/routing/search.js';
import { planPickSequence } from '../src/routing/picking.js';
import { compareLayouts, compareLayoutsAsync } from '../src/simulation/compare.js';
import { summarize } from '../src/simulation/metrics.js';
import { createReport, serializeReport, reproduceReport } from '../src/io/report.js';
import { LIMITS } from '../src/common/validation.js';
const raw = JSON.parse(fs.readFileSync(new URL('../examples/warehouse-scenario.json', import.meta.url), 'utf8'));
const demo = () => structuredClone(raw);
const trap = () => ({ version: 1, name: 'feasible trap', warehouse: {
  grid: { width: 4, height: 2, cells: Array(8).fill(1) }, depot: 0, slots: [
    { id: 'large', index: 1, zone: 'ambient', capacity: 10, maxWeight: 10 },
    { id: 'small', index: 3, zone: 'ambient', capacity: 1, maxWeight: 10 }] }, skus: [
  { sku: 'popular-small', picksPerDay: 100, size: 1, weight: 1, zone: 'ambient', demandCV: 0.2, slotId: 'small' },
  { sku: 'rare-large', picksPerDay: 1, size: 10, weight: 1, zone: 'ambient', demandCV: 0.2, slotId: 'large' }] });
function capture(config = {count: 1000, seed: 42, maxLines: 5}, algorithm = 'astar') {
  const s = validateScenario(demo()), current = currentAssignments(s.skus), suggested = optimizeSlotting(s.warehouse, s.skus, {algorithm}).assignments;
  const orders = generateOrders(s.skus, config), comparison = compareLayouts(s.warehouse, s.skus, orders, current, suggested, {algorithm});
  return createReport({ scenario: s, orders, current, suggested, comparison,
    orderConfig: { source: 'generated', generator: GENERATOR, ...config }, generatedAt: '2026-10-01T00:00:00.000Z' });
}

test('current assignment rejects duplicate occupancy', () => { const s=demo();s.skus[1].slotId=s.skus[0].slotId;assert.throws(()=>validateScenario(s),/more than one SKU/); });
test('current assignment rejects incompatible zone', () => { const s=demo();s.skus[0].zone='cold';assert.throws(()=>validateScenario(s),/does not fit/); });
test('current assignment rejects oversized SKU', () => { const s=demo();s.skus[0].size=99;assert.throws(()=>validateScenario(s),/does not fit/); });
test('current assignment rejects overweight SKU', () => { const s=demo();s.skus[0].weight=99;assert.throws(()=>validateScenario(s),/does not fit/); });
test('current assignment rejects disconnected occupied slot', () => { const s=demo(),i=s.warehouse.slots.find(x=>x.id===s.skus[0].slotId).index;for(const j of [i-1,i+1,i-18,i+18])s.warehouse.grid.cells[j]=0;assert.throws(()=>validateScenario(s),/unreachable/); });
test('unoccupied unreachable slots do not invalidate reachable allocations', () => { const s=demo();s.warehouse.slots.push({id:'spare',index:0,zone:'ambient',capacity:1,maxWeight:1});s.warehouse.grid.cells[1]=0;s.warehouse.grid.cells[18]=0;assert.equal(validateScenario(s).skus.length,10); });
test('assignment validation rejects missing and extra keys', () => { const s=demo(),m=currentAssignments(s.skus);m.delete(s.skus[0].sku);assert.throws(()=>validateAssignments(s.warehouse,s.skus,m),/every SKU/);m.set('unrelated','S01');assert.throws(()=>validateAssignments(s.warehouse,s.skus,m),/Unknown/); });
test('picking cannot bypass assignment compatibility', () => { const s=demo();s.skus[0].size=99;assert.throws(()=>planPickSequence(s.warehouse,s.skus,{id:'x',skus:[s.skus[0].sku]},currentAssignments(s.skus)),/does not fit/); });
test('picking rejects duplicate lines before routing', () => { const s=demo(),sku=s.skus[0].sku;assert.throws(()=>planPickSequence(s.warehouse,s.skus,{id:'x',skus:[sku,sku]},currentAssignments(s.skus)),/duplicate/); });
test('feasible greedy trap is repaired by reassignment', () => { const s=trap(),r=optimizeSlotting(s.warehouse,s.skus);assert.equal(r.repairUsed,true);assert.equal(r.assignments.get('popular-small'),'small');assert.equal(r.assignments.get('rare-large'),'large'); });
test('infeasible complete matching is reported as infeasible', () => { const s=trap();s.skus[0].size=10;assert.throws(()=>optimizeSlotting(s.warehouse,s.skus),/No complete compatible/); });
test('not enough physical slots fails before a partial allocation is returned', () => { const s=trap();s.warehouse.slots.pop();assert.throws(()=>optimizeSlotting(s.warehouse,s.skus),/Not enough slots/); });
test('optimizer returns deterministic assignments without mutating inputs', () => { const s=trap(),saved=JSON.stringify(s);assert.deepEqual(optimizeSlotting(s.warehouse,s.skus),optimizeSlotting(s.warehouse,s.skus));assert.equal(JSON.stringify(s),saved); });

test('null boolean and numeric-string model quantities are rejected', () => { for(const x of [null,true,false,'12',NaN,Infinity]) { const s=demo();s.skus[0].picksPerDay=x;assert.throws(()=>validateSkus(s.skus)); } });
test('null positions cannot silently become cell zero', () => { const s=demo();s.warehouse.depot=null;assert.throws(()=>validateWarehouse(s.warehouse)); });
test('overflowing demand values are rejected', () => { const s=demo();s.skus.forEach(x=>x.picksPerDay=1e308);assert.throws(()=>classifyABC(s.skus)); });
test('all-zero demand has C class rather than invented A priorities', () => { const s=demo();s.skus.forEach(x=>x.picksPerDay=0);assert.ok(classifyABC(s.skus).every(x=>x.abc==='C'&&x.cumulativeShare===0)); });
test('identifier text remains text without coerced objects', () => { const s=demo();s.skus[0].sku={toString(){return 'fake';}};assert.throws(()=>validateSkus(s.skus)); });
test('sparse grid is rejected', () => assert.throws(()=>validateGrid({width:2,height:2,cells:[1,,1,1]}),/sparse/));
test('sparse SKU array is rejected', () => {const s=demo();delete s.skus[1];assert.throws(()=>validateSkus(s.skus),/sparse/);});
test('singleton path still validates its index and walkability', () => { const g={width:2,height:2,cells:[0,1,1,1]};for(const p of [[-1],[4],[0]])assert.throws(()=>pathCost(g,p)); });
test('a valid empty path costs zero and malformed path is rejected', () => { const g=demo().warehouse.grid;assert.equal(pathCost(g,[]),0);assert.throws(()=>pathCost(g,null)); });
test('scenario text size limit applies before JSON parsing', () => assert.throws(()=>parseScenario(' '.repeat(LIMITS.scenarioBytes+1)),/exceeds/));
test('orders cannot use objects in place of ids or SKU values', () => {const s=demo();assert.throws(()=>validateOrders([{id:123,skus:[s.skus[0].sku]}],s.skus));assert.throws(()=>validateOrders([{id:'x',skus:[{}]}],s.skus));});

test('seed must be an unsigned integer and is not silently aliased', () => { for(const seed of [-1,1.5,2**32,NaN,Infinity,'42',null])assert.throws(()=>validateOrderConfig({seed}));assert.equal(validateOrderConfig({seed:0}).seed,0); });
test('zero seed and one seed have distinct deterministic streams', () => {const s=demo();assert.notDeepEqual(generateOrders(s.skus,{count:30,seed:0}),generateOrders(s.skus,{count:30,seed:1}));});
test('skewed demand completes requested unique-line counts', () => { const s=demo().skus.slice(0,2);s[0].picksPerDay=1e9;s[1].picksPerDay=1;const orders=generateOrders(s,{count:40,seed:42,maxLines:2});assert.ok(orders.some(o=>o.skus.length===2));assert.ok(orders.every(o=>new Set(o.skus).size===o.skus.length)); });
test('zero demand SKU is not sampled among positive demand SKUs', () => {const s=demo().skus.slice(0,2);s[1].picksPerDay=0;assert.ok(generateOrders(s,{count:20,maxLines:2}).every(o=>o.skus.length===1&&o.skus[0]===s[0].sku));});
test('all-zero demand uses uniform sampling and fills lines', () => {const s=demo().skus.slice(0,2);s.forEach(x=>x.picksPerDay=0);assert.ok(generateOrders(s,{count:20,maxLines:2}).some(o=>o.skus.length===2));});
test('generator does not mutate demand rows', () => {const s=demo().skus,v=JSON.stringify(s);generateOrders(s,{count:20});assert.equal(JSON.stringify(s),v);});

test('distance-cache results are immutable', () => {const s=demo().warehouse,o=createDistanceOracle(s.grid);const r=o.get(s.depot,s.slots[0].index);assert.throws(()=>r.cost=-1,TypeError);assert.throws(()=>r.path.push(0),TypeError);assert.ok(o.get(s.depot,s.slots[0].index).cost>0);});
test('oracle from a different graph cannot corrupt routing', () => {const s=demo(),g=structuredClone(s.warehouse.grid);g.cells[2]=3;const o=createDistanceOracle(g);assert.throws(()=>planPickSequence(s.warehouse,s.skus,{id:'x',skus:[s.skus[0].sku]},currentAssignments(s.skus),{oracle:o}),/does not belong/);});
test('unknown algorithm fails at oracle construction', () => assert.throws(()=>createDistanceOracle(demo().warehouse.grid,'unknown'),/Unknown/));
test('metrics reject NaN infinity strings and negative cost', () => {for(const v of [NaN,Infinity,'1',-1])assert.throws(()=>summarize([v]));});
test('async and sync comparison outputs agree', async () => { const s=validateScenario(demo()),o=generateOrders(s.skus,{count:75}),c=currentAssignments(s.skus),a=optimizeSlotting(s.warehouse,s.skus).assignments;let yields=0;const r=await compareLayoutsAsync(s.warehouse,s.skus,o,c,a,{yieldControl:async()=>{yields++;}});assert.deepEqual(r,compareLayouts(s.warehouse,s.skus,o,c,a));assert.ok(yields>0); });

test('default 1000-order scenario retains exact prior totals and outcomes', () => {const r=capture().result;assert.equal(r.before.total,44194);assert.equal(r.after.total,37266);assert.deepEqual([r.improved,r.unchanged,r.worsened],[786,134,80]);});
test('default report exports every input needed for replay', () => {const r=capture({count:10,seed:42,maxLines:5});assert.ok(r.scenario.warehouse.grid.cells.length);assert.equal(r.orders.length,10);assert.equal(Object.keys(r.assignments.current).length,10);assert.equal(Object.keys(r.assignments.suggested).length,10);assert.equal(r.engineVersion,'1.0.1');});
test('JSON round-trip reproduces recorded results from inputs', () => {const r=capture({count:40,seed:42,maxLines:5});assert.equal(reproduceReport(serializeReport(r)).verified,true);});
test('all three pathfinders reproduce their exported results', () => {for(const a of ['astar','dijkstra','bidijkstra'])assert.equal(reproduceReport(serializeReport(capture({count:15,seed:7,maxLines:4},a))).verified,true);});
test('tampered aggregate does not verify', () => {const r=capture({count:5,seed:42,maxLines:5});r.result.before.total++;assert.throws(()=>reproduceReport(r),/mismatch/);});
test('tampered order list does not verify against generation settings', () => {const r=capture({count:5,seed:42,maxLines:5});r.orders[0].id='changed';assert.throws(()=>reproduceReport(r),/generator/);});
test('tampered routing path does not verify', () => {const r=capture({count:5,seed:42,maxLines:5});r.result.firstOrder.after.segments[0].path[0]=0;assert.throws(()=>reproduceReport(r),/mismatch/);});
test('tampered settings cannot be mislabeled as original results', () => {const r=capture({count:5,seed:42,maxLines:5});r.orderConfig.seed=4;assert.throws(()=>reproduceReport(r));});
test('unsupported report engine is rejected instead of silently substituted', () => {const r=capture({count:5,seed:42,maxLines:5});r.engineVersion='0.1';assert.throws(()=>reproduceReport(r),/Unsupported/);});
test('supplied scenario orders are replayed directly without generation', () => {const s=validateScenario(demo());s.orders=[{id:'manual',skus:[s.skus[0].sku]}];const c=currentAssignments(s.skus),a=optimizeSlotting(s.warehouse,s.skus).assignments,r=compareLayouts(s.warehouse,s.skus,s.orders,c,a);const x=createReport({scenario:s,orders:s.orders,current:c,suggested:a,comparison:r,orderConfig:{source:'scenario'}});assert.equal(reproduceReport(serializeReport(x)).orders,1);});

// An independently implemented Floyd–Warshall oracle, not another call to the tested heap search.
function distances(cells,w,h){const n=cells.length,d=Array.from({length:n},()=>Array(n).fill(Infinity));for(let u=0;u<n;u++){if(!cells[u])continue;d[u][u]=0;for(let v=0;v<n;v++)if(cells[v]&&Math.abs(u%w-v%w)+Math.abs(Math.floor(u/w)-Math.floor(v/w))===1)d[u][v]=cells[v];}for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)d[i][j]=Math.min(d[i][j],d[i][k]+d[k][j]);return d;}
test('exhaustive 2x2 weighted grids agree with Floyd–Warshall for every walkable pair', () => {let cases=0;for(let mask=0;mask<256;mask++){let n=mask;const cells=Array.from({length:4},()=>{const v=[0,1,3,6][n%4];n=Math.floor(n/4);return v;}),oracle=distances(cells,2,2),grid={width:2,height:2,cells};for(let a=0;a<4;a++)for(let b=0;b<4;b++){if(!cells[a]||!cells[b])continue;for(const method of ['astar','dijkstra','bidijkstra']){const r=shortestPath(grid,a,b,method);assert.equal(r.cost,Number.isFinite(oracle[a][b])?oracle[a][b]:null);if(r.found){assert.equal(r.path[0],a);assert.equal(r.path.at(-1),b);assert.equal(pathCost(grid,r.path),r.cost);}cases++;}}}assert.equal(cases,7488);});
test('seeded 3x3 disconnected and asymmetric grids agree with independent distance oracle', () => {let x=91;for(let t=0;t<100;t++){const cells=Array.from({length:9},()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return [0,1,3,6][(x>>>16)%4];}),oracle=distances(cells,3,3),g={width:3,height:3,cells};for(let a=0;a<9;a++)for(let b=0;b<9;b++)if(cells[a]&&cells[b])for(const method of ['astar','dijkstra','bidijkstra'])assert.equal(shortestPath(g,a,b,method).cost,Number.isFinite(oracle[a][b])?oracle[a][b]:null);}});

test('small constrained matchings agree with independent exhaustive assignment enumeration', () => {
  let seed=413; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let caseId=0;caseId<256;caseId++) {
    const warehouse={grid:{width:4,height:2,cells:Array(8).fill(1)},depot:0,slots:Array.from({length:3},(_,i)=>({id:`s${i}`,index:i+1,zone:['a','b','any'][random()%3],capacity:1+random()%3,maxWeight:1+random()%3}))};
    const skus=Array.from({length:3},(_,i)=>({sku:`k${i}`,picksPerDay:20-i,size:1+random()%3,weight:1+random()%3,zone:['a','b'][random()%2],demandCV:0.2,slotId:`s${i}`}));
    const fits=(k,s)=>k.size<=s.capacity&&k.weight<=s.maxWeight&&(s.zone==='any'||k.zone===s.zone);
    const enumerate=(k,used)=>k===skus.length||warehouse.slots.some((s,j)=>!used.has(j)&&fits(skus[k],s)&&enumerate(k+1,new Set([...used,j])));
    const feasible=enumerate(0,new Set());
    if(!feasible)assert.throws(()=>optimizeSlotting(warehouse,skus),/No complete compatible/);
    else {const r=optimizeSlotting(warehouse,skus);assert.equal(validateAssignments(warehouse,skus,r.assignments).size,3);}
  }
});


test('pathological demand cannot consume unbounded generator work', () => {
  const rows = Array.from({length: 500}, (_, i) => ({sku: `sku-${i}`, picksPerDay: i === 0 ? 1e9 : 1,
    slotId: `slot-${i}`, size: 1, weight: 1, zone: 'ambient', demandCV: 0.25}));
  assert.throws(() => generateOrders(rows, {count: 10000, maxLines: 25, seed: 42}), /work limit/i);
});
