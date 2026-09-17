/* Shared query model: Apps Script and browser. No source IDs or private files. */
(function(root){
'use strict';
const companies=['EU','TEX'];
const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
const endOfMonth=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).toISOString().slice(0,10);
const nextDay=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
function covers(ranges,company,from,to){
 let cursor=from;
 for(const r of ranges.filter(r=>r.company===company&&r.complete).sort((a,b)=>a.from.localeCompare(b.from))){
  if(r.to<cursor)continue;if(r.from>cursor)return false;cursor=nextDay(r.to);if(cursor>to)return true;
 }return false;
}
function coalesce(ranges){
 const out=[];
 for(const company of companies){
  for(const r of ranges.filter(r=>r.company===company&&r.complete).sort((a,b)=>a.from.localeCompare(b.from))){
   const last=out[out.length-1];
   if(last&&last.company===company&&r.from<=nextDay(last.to))last.to=last.to>r.to?last.to:r.to;
   else out.push({...r});
  }
 }return out;
}
function groupStock(rows){
 const grouped=new Map();
 for(const r of rows){
  const key=JSON.stringify([r.company,r.ref,r.warehouse]);
  if(!grouped.has(key))grouped.set(key,{company:r.company,ref:r.ref,description:r.description,warehouse:r.warehouse,units:0,committed:0,available:0});
  const g=grouped.get(key);for(const k of ['units','committed','available'])g[k]+=r[k];
 }return [...grouped.values()];
}
function stockTotals(rows){return {units:sum(rows,'units'),committed:sum(rows,'committed'),available:sum(rows,'available')};}
function daily(rows,start){
 const map=new Map();
 for(const r of rows){if(r.date<start)continue;
  const key=JSON.stringify([r.company,r.warehouse,r.date]);
  if(!map.has(key))map.set(key,{company:r.company,warehouse:r.warehouse,date:r.date,in:0,out:0});
  const g=map.get(key);g.in+=r.in;g.out+=r.out;
 }return [...map.values()];
}
function apply(previous,batch,id,start){
 const q=previous?JSON.parse(JSON.stringify(previous)):{schema:1,startCutoff:start,processed:[],cuts:[],ledger:[],coverage:[]};
 if(q.processed.includes(id))return q;
 for(const c of batch.coverage.filter(c=>c.complete)){
  q.ledger=q.ledger.filter(r=>!(r.company===c.company&&r.date>=c.from&&r.date<=c.to));
  q.ledger.push(...daily(batch.movements.filter(r=>r.company===c.company&&r.date>=c.from&&r.date<=c.to),q.startCutoff));
  if(c.to>=q.startCutoff)q.coverage.push({...c,from:c.from<q.startCutoff?q.startCutoff:c.from});
 }
 q.coverage=coalesce(q.coverage);q.processed.push(id);
 if(batch.inventoryComplete){
  const rows=groupStock(batch.inventory),summary=[...new Set(rows.map(r=>JSON.stringify([r.company,r.warehouse])))].map(key=>{const [company,warehouse]=JSON.parse(key);return {company,warehouse,...stockTotals(rows.filter(r=>r.company===company&&r.warehouse===warehouse))};});
  q.cuts=q.cuts.filter(c=>c.cutoff!==batch.cutoff);
  q.cuts.push({id,cutoff:batch.cutoff,summary});q.cuts.sort((a,b)=>a.cutoff.localeCompare(b.cutoff));
 }
 return q;
}
function monthly(query,cutoff,company='',warehouse=''){
 const selected=company?[company]:companies,results=[];
 let month=query.startCutoff.slice(0,7);
 while(month<=cutoff.slice(0,7)){
  const first=month+'-01',last=endOfMonth(month),from=first<query.startCutoff?query.startCutoff:first,to=last>cutoff?cutoff:last;
  const complete=selected.every(c=>covers(query.coverage,c,from,to));
  const rows=query.ledger.filter(r=>selected.includes(r.company)&&(!warehouse||r.warehouse===warehouse)&&r.date>=from&&r.date<=to);
  const cut=query.cuts.filter(c=>c.cutoff.slice(0,7)===month&&c.cutoff<=cutoff).at(-1);
  results.push({month,from,to,complete,in:complete?sum(rows,'in'):null,out:complete?sum(rows,'out'):null,
   cutoff:cut?.cutoff||null,units:cut?sum(cut.summary.filter(r=>selected.includes(r.company)&&(!warehouse||r.warehouse===warehouse)),'units'):null,
   status:!complete?'Cobertura pendiente':from!==first?'Primer mes parcial':to!==last?'Período parcial':'Mes completo',
   stockStatus:cut?.cutoff===last?'Corte de fin de mes':'Último corte disponible'});
  month=nextDay(last).slice(0,7);
 }return results;
}
function filterStock(rows,company='',warehouse='',search=''){
 const s=search.trim().toLocaleLowerCase('es');
 return rows.filter(r=>(!company||r.company===company)&&(!warehouse||r.warehouse===warehouse)&&(!s||(r.ref+' '+r.description).toLocaleLowerCase('es').includes(s)));
}
function compare(current,previous){
 if(!previous)return null;const a=stockTotals(current).units,b=stockTotals(previous).units;
 return {units:a-b,percent:b===0?null:(a-b)/Math.abs(b)*100};
}
const api={groupStock,stockTotals,apply,monthly,filterStock,compare,covers};
root.PccHistoryModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
