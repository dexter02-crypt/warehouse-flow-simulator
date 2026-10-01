import {validateWarehouse} from "../domain/warehouse.js";
import {validateSkus} from "../domain/sku.js";
import {validateOrders} from "../domain/orders.js";
import {createDistanceOracle} from "../routing/search.js";
import {planPickSequence} from "../routing/picking.js";
import {summarize} from "./metrics.js";
export function compareLayouts(warehouse,rows,orders,currentAssignments,suggestedAssignments,{algorithm="astar"}={}){const w=validateWarehouse(warehouse),skus=validateSkus(rows),cleanOrders=validateOrders(orders,skus),oracle=createDistanceOracle(w.grid,algorithm);const perOrder=[];let improved=0,unchanged=0,worsened=0;for(const order of cleanOrders){const before=planPickSequence(w,skus,order,currentAssignments,{algorithm,oracle}),after=planPickSequence(w,skus,order,suggestedAssignments,{algorithm,oracle}),delta=after.totalCost-before.totalCost;if(delta<0)improved++;else if(delta>0)worsened++;else unchanged++;perOrder.push({id:order.id,before:before.totalCost,after:after.totalCost,delta,beforeRoute:before,afterRoute:after});}const beforeValues=perOrder.map(x=>x.before),afterValues=perOrder.map(x=>x.after),before=summarize(beforeValues),after=summarize(afterValues);return {algorithm,before,after,reduction:before.total?1-after.total/before.total:0,improved,unchanged,worsened,perOrder,oracleEntries:oracle.cacheSize()};}
