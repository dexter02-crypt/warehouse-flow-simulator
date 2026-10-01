import {validateWarehouse} from "../domain/warehouse.js";
import {validateSkus} from "../domain/sku.js";
import {validateOrders} from "../domain/orders.js";
export function validateScenario(raw){if(!raw||raw.version!==1)throw new Error("scenario-version");const warehouse=validateWarehouse(raw.warehouse),skus=validateSkus(raw.skus),slotIds=new Set(warehouse.slots.map(x=>x.id));if(skus.some(x=>!slotIds.has(x.slotId)))throw new Error("scenario-slot");const orders=raw.orders==null?null:validateOrders(raw.orders,skus);return {version:1,name:String(raw.name??"Warehouse Flow Scenario").slice(0,120),warehouse,skus,orders};}
export function serializeScenario(raw){return JSON.stringify(validateScenario(raw),null,2)+"\n";}
export function parseScenario(text){return validateScenario(JSON.parse(String(text)));}
