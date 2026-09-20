/* Shared query model: Apps Script and browser. No source IDs or private files. */
(function(root){
'use strict';
const companies=['EU','TEX'];
const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
const endOfMonth=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5,7),0)).toISOString().slice(0,10);
const nextDay=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
function exactPeriod(from,to,cutoff=to){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
 if(!valid(from)||!valid(to)||!valid(cutoff)||from>to||to>cutoff)return {days:0,from:null,to:null,label:'Período no verificado',missing:[]};
 return {from,to,days:(Date.parse(to)-Date.parse(from))/86400000+1,label:from.split('-').reverse().join('/')+' – '+to.split('-').reverse().join('/'),missing:[]};
}
function declaredPeriod(table){
 const headers=table[0]||[],keys=['MOVIMIENTOS_DESDE','MOVIMIENTOS_HASTA','FECHA_CORTE_DATOS'],indices=keys.map(k=>headers.indexOf(k));
 const invalid=()=>exactPeriod(null,null);
 if(indices.some(i=>i<0)||table.length<2)return invalid();
 const unique=indices.map(i=>[...new Set(table.slice(1).map(r=>r[i]))]);
 return unique.some(v=>v.length!==1)?invalid():exactPeriod(...unique.map(v=>v[0]));
}
const isFirst=warehouse=>!['PT002','PT003','TI005','TI006'].includes(String(warehouse).trim().toUpperCase());
// Preserve the dispatch window that belonged to this stock cut, not a later export.
function rotationSnapshot(batch){
 const ranges=companies.map(company=>batch.coverage.find(c=>c.company===company&&c.complete));
 const periods=ranges.map(r=>r?exactPeriod(r.from,r.to,batch.cutoff):exactPeriod(null,null));
 if(periods.some(p=>!p.days)||periods.some(p=>p.from!==periods[0].from||p.to!==periods[0].to))return null;
 const period=periods[0],map=new Map();
 for(const r of batch.movements){
  if(String(r.type).trim().toUpperCase()!=='RM'||r.out<=0||r.date<period.from||r.date>period.to)continue;
  const key=JSON.stringify([r.company,r.ref,r.warehouse]);
  if(!map.has(key))map.set(key,{company:r.company,ref:r.ref,warehouse:r.warehouse,description:r.description||'',units:0});
  map.get(key).units+=r.out;
 }
 return {period,dispatch:[...map.values()]};
}
function coverageAtCut(detail,predicate=()=>true){
 const rotation=detail?.rotation,period=rotation&&exactPeriod(rotation.period.from,rotation.period.to,detail.cutoff);
 if(!period?.days||!Array.isArray(rotation.dispatch))return null;
 const stock=detail.rows.filter(r=>isFirst(r.warehouse)&&predicate(r)).reduce((n,r)=>n+r.units,0);
 const dispatch=rotation.dispatch.filter(r=>isFirst(r.warehouse)&&predicate(r)).reduce((n,r)=>n+r.units,0);
 return {cutoff:detail.cutoff,period,stock,dispatch,days:dispatch>0?stock/(dispatch/period.days):null};
}
function monthlyCuts(cuts,cutoff,count=6){
 const latest=new Map();
 for(const cut of cuts.filter(c=>c.cutoff<=cutoff).sort((a,b)=>a.cutoff.localeCompare(b.cutoff)))latest.set(cut.cutoff.slice(0,7),cut);
 return [...latest.values()].slice(-count);
}
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
const api={groupStock,stockTotals,apply,monthly,filterStock,compare,covers,exactPeriod,declaredPeriod,isFirst,rotationSnapshot,coverageAtCut,monthlyCuts};
root.PccHistoryModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
