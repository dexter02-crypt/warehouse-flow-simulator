import {validateWarehouse} from "../domain/warehouse.js";
import {classifySkus,validateSkus} from "../domain/sku.js";
import {compatibleSkuSlot} from "./constraints.js";
import {createDistanceOracle} from "../routing/search.js";
export function currentAssignments(rows){return new Map(validateSkus(rows).map(x=>[x.sku,x.slotId]));}
export function optimizeSlotting(warehouse,rows,{algorithm="astar"}={}){const w=validateWarehouse(warehouse),skus=classifySkus(rows),oracle=createDistanceOracle(w.grid,algorithm);const ranked=w.slots.map(slot=>{const r=oracle.get(w.depot,slot.index);return {...slot,distance:r.found?r.cost:Infinity};}).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));const remaining=[...ranked],assignments=new Map(),details=[];for(const sku of skus){const idx=remaining.findIndex(slot=>Number.isFinite(slot.distance)&&compatibleSkuSlot(sku,slot));if(idx<0)throw new Error(`no-compatible-slot:${sku.sku}`);const slot=remaining.splice(idx,1)[0];assignments.set(sku.sku,slot.id);details.push({sku:sku.sku,abc:sku.abc,xyz:sku.xyz,slotId:slot.id,distance:slot.distance});}return {assignments,details,algorithm};}
