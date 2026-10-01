import test from "node:test";import assert from "node:assert/strict";
import {mean,median,percentile,summarize} from "../src/simulation/metrics.js";
import {compareLayouts} from "../src/simulation/compare.js";
const wh={grid:{width:5,height:3,cells:Array(15).fill(1)},depot:10,slots:[
 {id:"N",index:11,zone:"ambient",capacity:4,maxWeight:10},
 {id:"M",index:7,zone:"ambient",capacity:4,maxWeight:10},
 {id:"F",index:4,zone:"ambient",capacity:4,maxWeight:10}
]};
const skus=[
 {sku:"A",picksPerDay:100,size:1,weight:1,zone:"ambient",demandCV:.2,slotId:"F"},
 {sku:"B",picksPerDay:50,size:1,weight:1,zone:"ambient",demandCV:.6,slotId:"M"}
];
const orders=[{id:"O1",skus:["A"]},{id:"O2",skus:["A","B"]},{id:"O3",skus:["B"]}];
const current=new Map([["A","F"],["B","M"]]),suggested=new Map([["A","N"],["B","M"]]);
test("mean",()=>assert.equal(mean([1,2,3]),2));
test("median odd",()=>assert.equal(median([3,1,2]),2));
test("median even",()=>assert.equal(median([4,1,3,2]),2.5));
test("percentile p95 deterministic nearest-rank",()=>assert.equal(percentile([1,2,3,4,5],.95),5));
test("summarize totals",()=>assert.equal(summarize([2,3,5]).total,10));
test("comparison evaluates every order",()=>assert.equal(compareLayouts(wh,skus,orders,current,suggested).perOrder.length,3));
test("comparison uses same order ids",()=>assert.deepEqual(compareLayouts(wh,skus,orders,current,suggested).perOrder.map(x=>x.id),orders.map(x=>x.id)));
test("comparison outcome buckets sum to order count",()=>{const r=compareLayouts(wh,skus,orders,current,suggested);assert.equal(r.improved+r.unchanged+r.worsened,orders.length)});
test("suggested layout improves total in deterministic sample",()=>{const r=compareLayouts(wh,skus,orders,current,suggested);assert.ok(r.after.total<r.before.total)});
test("reduction agrees with totals",()=>{const r=compareLayouts(wh,skus,orders,current,suggested);assert.equal(r.reduction,1-r.after.total/r.before.total)});
test("comparison is deterministic",()=>assert.deepEqual(compareLayouts(wh,skus,orders,current,suggested),compareLayouts(wh,skus,orders,current,suggested)));
test("Dijkstra and A* comparison totals agree",()=>assert.deepEqual(compareLayouts(wh,skus,orders,current,suggested,{algorithm:"astar"}).after,compareLayouts(wh,skus,orders,current,suggested,{algorithm:"dijkstra"}).after));
test("bidirectional totals agree with Dijkstra",()=>assert.deepEqual(compareLayouts(wh,skus,orders,current,suggested,{algorithm:"bidijkstra"}).after,compareLayouts(wh,skus,orders,current,suggested,{algorithm:"dijkstra"}).after));
