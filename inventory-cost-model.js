/* Monthly inventory valuation using only published cut dates. */
(function(root){
 'use strict';
 const finite=Number.isFinite;
 const sources=['wip','pt','log'];
 const endOfMonth=month=>new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).toISOString().slice(0,10);
 const validDate=date=>/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date||'')&&date.slice(8)>='01'&&date<=endOfMonth(date.slice(0,7));
 const companyKey=value=>String(value||'').toUpperCase().includes('TEX')?'TEX':String(value||'').toUpperCase();
 function stockPoint(cut,company,kind){
  const rows=cut.summary.filter(row=>!company||companyKey(row.company)===company);
  const records=rows.filter(row=>kind==='pt'?
   finite(row.knownValue)&&(row.knownCostUnits>0||row.missingCostUnits===0):
   finite(row.value));
  if(!records.length&&rows.length)return null;
  const value=records.reduce((total,row)=>total+(kind==='pt'?row.knownValue:row.value),0);
  return {cutoff:cut.cutoff,value,partial:records.length<rows.length||rows.some(row=>row.missingCostUnits>0)};
 }
 function monthly({pt=[],log=[],currentMonth,company='',exact=false,count=12}){
  const maps={wip:new Map(),pt:new Map(),log:new Map()};
  for(const kind of ['pt','log']){
   for(const cut of [...(kind==='pt'?pt:log)].sort((a,b)=>a.cutoff.localeCompare(b.cutoff))){
    if(!validDate(cut.cutoff)||!Array.isArray(cut.summary))continue;
    const month=cut.cutoff.slice(0,7);
    if(exact&&cut.cutoff!==endOfMonth(month))continue;
    maps[kind].set(month,{...(stockPoint(cut,company,kind)||{cutoff:cut.cutoff,value:null}),exact:cut.cutoff===endOfMonth(month)});
   }
  }
  const points=[];
  const current=new Date(currentMonth+'-01T00:00:00Z');
  if(!finite(+current))return points;
  // A current-month cut is shown in the current view, never as a past close.
  for(let offset=count;offset>=1;offset--){
   const month=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-offset,1)).toISOString().slice(0,7);
   const values=Object.fromEntries(sources.map(key=>[key,maps[key].get(month)||null]));
   const valued=sources.filter(key=>finite(values[key]?.value));
   const sameCut=new Set(valued.map(key=>values[key].cutoff)).size<=1;
   const total=valued.length&&sameCut?valued.reduce((sum,key)=>sum+values[key].value,0):null;
   const prev=points.at(-1);
   const comparable=valued.length&&prev&&prev.valued.join()===valued.join()&&finite(prev.total)&&finite(total)&&
    valued.every(key=>values[key].cutoff===endOfMonth(month)&&prev.values[key].cutoff===endOfMonth(prev.month)&&
     !values[key].partial&&!prev.values[key].partial);
   points.push({month,values,valued,total,sameCut,delta:comparable?total-prev.total:null,
    rate:comparable&&prev.total>0?(total-prev.total)/prev.total:null});
  }
  return points;
 }
 const api={monthly,sources};
 root.PccInventoryCostModel=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
