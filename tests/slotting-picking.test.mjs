import test from "node:test";import assert from "node:assert/strict";
import {compatibleSkuSlot} from "../src/slotting/constraints.js";
import {optimizeSlotting,currentAssignments} from "../src/slotting/optimizer.js";
import {planPickSequence} from "../src/routing/picking.js";
const grid={width:5,height:3,cells:Array(15).fill(1)};
const wh={grid,depot:10,slots:[
 {id:"N",index:11,zone:"ambient",capacity:4,maxWeight:10},
 {id:"M",index:7,zone:"ambient",capacity:2,maxWeight:5},
 {id:"F",index:4,zone:"ambient",capacity:4,maxWeight:10},
 {id:"C",index:9,zone:"cold",capacity:2,maxWeight:5}
]};
const skus=[
 {sku:"A",picksPerDay:100,size:2,weight:3,zone:"ambient",demandCV:.2,slotId:"F"},
 {sku:"B",picksPerDay:50,size:1,weight:1,zone:"ambient",demandCV:.6,slotId:"M"},
 {sku:"COLD",picksPerDay:10,size:1,weight:1,zone:"cold",demandCV:1.2,slotId:"C"}
];
test("compatible slot accepts within bounds",()=>assert.equal(compatibleSkuSlot(skus[0],wh.slots[0]),true));
test("capacity violation rejected",()=>assert.equal(compatibleSkuSlot({...skus[0],size:9},wh.slots[0]),false));
test("weight violation rejected",()=>assert.equal(compatibleSkuSlot({...skus[0],weight:99},wh.slots[0]),false));
test("zone violation rejected",()=>assert.equal(compatibleSkuSlot(skus[0],wh.slots[3]),false));
test("any zone accepts other SKU zone",()=>assert.equal(compatibleSkuSlot(skus[0],{...wh.slots[0],zone:"any"}),true));
test("current assignments read SKU slot ids",()=>assert.equal(currentAssignments(skus).get("A"),"F"));
test("optimizer assigns every SKU once",()=>{const o=optimizeSlotting(wh,skus);assert.equal(o.assignments.size,3);assert.equal(new Set(o.assignments.values()).size,3)});
test("optimizer keeps cold SKU in cold slot",()=>assert.equal(optimizeSlotting(wh,skus).assignments.get("COLD"),"C"));
test("highest activity compatible SKU moves nearest",()=>assert.equal(optimizeSlotting(wh,skus).assignments.get("A"),"N"));
test("optimizer refuses impossible constraints",()=>assert.throws(()=>optimizeSlotting(wh,[{...skus[0],size:99}])));
test("single-pick route returns depot",()=>{const a=currentAssignments(skus),r=planPickSequence(wh,skus,{id:"O1",skus:["A"]},a);assert.equal(r.segments.at(-1).to,wh.depot)});
test("multi-pick route visits every requested SKU",()=>{const a=currentAssignments(skus),r=planPickSequence(wh,skus,{id:"O1",skus:["A","B","COLD"]},a);assert.deepEqual(new Set(r.sequence),new Set(["A","B","COLD"]))});
test("nearest-next order is deterministic",()=>{const a=currentAssignments(skus),o={id:"O1",skus:["A","B"]};assert.deepEqual(planPickSequence(wh,skus,o,a),planPickSequence(wh,skus,o,a))});
test("route total cost equals segment sum",()=>{const a=currentAssignments(skus),r=planPickSequence(wh,skus,{id:"O1",skus:["A","B"]},a);assert.equal(r.totalCost,r.segments.reduce((s,x)=>s+x.cost,0))});
test("missing assignment rejected",()=>{const a=new Map([["A","F"]]);assert.throws(()=>planPickSequence(wh,skus,{id:"O1",skus:["B"]},a))});
