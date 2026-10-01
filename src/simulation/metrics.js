export function mean(values){if(!Array.isArray(values)||!values.length)throw new Error("values");return values.reduce((a,b)=>a+b,0)/values.length;}
export function median(values){if(!Array.isArray(values)||!values.length)throw new Error("values");const x=[...values].sort((a,b)=>a-b),m=Math.floor(x.length/2);return x.length%2?x[m]:(x[m-1]+x[m])/2;}
export function percentile(values,p){if(!Array.isArray(values)||!values.length||!Number.isFinite(p)||p<0||p>1)throw new Error("percentile");const x=[...values].sort((a,b)=>a-b),i=Math.ceil(p*x.length)-1;return x[Math.max(0,i)];}
export function summarize(values){return {count:values.length,total:values.reduce((a,b)=>a+b,0),mean:mean(values),median:median(values),p95:percentile(values,.95),min:Math.min(...values),max:Math.max(...values)};}
