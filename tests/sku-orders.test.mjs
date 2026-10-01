import test from "node:test";import assert from "node:assert/strict";
import {validateSkus,classifyABC,xyzClass,classifySkus} from "../src/domain/sku.js";
import {generateOrders,validateOrders} from "../src/domain/orders.js";
const skus=[
 {sku:"A",picksPerDay:100,size:1,weight:1,zone:"ambient",demandCV:.2,slotId:"S1"},
 {sku:"B",picksPerDay:50,size:1,weight:1,zone:"ambient",demandCV:.7,slotId:"S2"},
 {sku:"C",picksPerDay:10,size:1,weight:1,zone:"cold",demandCV:1.2,slotId:"S3"},
 {sku:"D",picksPerDay:5,size:1,weight:1,zone:"cold",demandCV:1.5,slotId:"S4"}
];
test("SKU validation preserves rows",()=>assert.equal(validateSkus(skus).length,4));
test("SKU validation rejects duplicate ids",()=>assert.throws(()=>validateSkus([skus[0],{...skus[1],sku:"A"}])));
test("SKU validation rejects negative picks",()=>assert.throws(()=>validateSkus([{...skus[0],picksPerDay:-1}])));
test("ABC highest activity begins in A",()=>assert.equal(classifyABC(skus)[0].abc,"A"));
test("ABC assigns every row",()=>assert.equal(classifyABC(skus).length,4));
test("XYZ threshold X inclusive",()=>assert.equal(xyzClass(.5),"X"));
test("XYZ threshold Y inclusive",()=>assert.equal(xyzClass(1),"Y"));
test("XYZ above one is Z",()=>assert.equal(xyzClass(1.01),"Z"));
test("classification combines ABC and XYZ",()=>assert.ok(classifySkus(skus).every(x=>x.abc&&x.xyz)));
test("orders are deterministic by seed",()=>assert.deepEqual(generateOrders(skus,{count:20,seed:7,maxLines:3}),generateOrders(skus,{count:20,seed:7,maxLines:3})));
test("different seeds change generated orders",()=>assert.notDeepEqual(generateOrders(skus,{count:20,seed:7,maxLines:3}),generateOrders(skus,{count:20,seed:8,maxLines:3})));
test("generated order lines are unique",()=>assert.ok(generateOrders(skus,{count:50,seed:2,maxLines:4}).every(o=>new Set(o.skus).size===o.skus.length)));
test("generated max lines respected",()=>assert.ok(generateOrders(skus,{count:50,seed:2,maxLines:2}).every(o=>o.skus.length<=2)));
test("order bounds enforced",()=>assert.throws(()=>generateOrders(skus,{count:0})));
test("order validation rejects unknown SKU",()=>assert.throws(()=>validateOrders([{id:"O1",skus:["X"]}],skus)));
test("order validation rejects duplicate order ids",()=>assert.throws(()=>validateOrders([{id:"O1",skus:["A"]},{id:"O1",skus:["B"]}],skus)));
