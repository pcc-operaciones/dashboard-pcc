/* Shared cost arithmetic. Amounts are COP; ct and margen are per unit. */
(function(root){
'use strict';
const finite=Number.isFinite;
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const mean=(rows,key)=>{const values=rows.map(r=>r[key]).filter(finite);return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;};
const total=(rows,key)=>{const values=rows.map(r=>r[key]).filter(finite);return values.length?values.reduce((a,b)=>a+b,0):null;};
const monthNames=['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'];
const monthLabel=key=>monthNames[+key.slice(5)-1]+' '+key.slice(0,4);
function number(value){
 if(typeof value==='number')return finite(value)?value:null;
 if(value===null||value===undefined)return null;
 let s=String(value).trim().replace(/[$\s\u00a0]/g,'');
 if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(s.includes(','))s=s.replace(',','.');
 else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
 // Cost exports use decimal comma/dot, including three decimals: never guess thousands.
 if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s))return null;
 const n=Number(s);return finite(n)?n:null;
}
function percent(value){
 if(typeof value==='string'&&value.includes('%')){const n=number(value.replace('%',''));return n===null?null:n/100;}
 return number(value);
}
function classify(r){
 const cat=norm(r.subcat),raw=norm(r.linea),co=norm(r.empresa);
 const nativeLine=raw==='TEX'||co.includes('TEX')?'TEX':/YETRO/.test(raw+' '+cat)?'YETRO':/TWO|TYT/.test(raw+' '+cat)?'TWOTWO':'EU';
 const company=nativeLine==='TEX'?'TEX':'EU',line={TEX:'TEXSION',EU:'EU',YETRO:'YETRO',TWOTWO:'TWO&TWO'}[nativeLine];
 const cats=nativeLine==='YETRO'?['YETRO']:nativeLine==='TWOTWO'?['TWO&TWO']:nativeLine==='EU'?/MODA|NEW|NUEV/.test(cat)?['EU Moda']:/LINEA|BASICO|LIQUID|DOTAC/.test(cat)?['EU Línea']:[]:/DOTAC/.test(cat)?['DOTACIÓN']:['EVA','LAXO','DISNEY'].includes(cat)?[cat]:[];
 return {company,line,cats,nativeLine};
}
function summary(rows){return {count:rows.length,rent:mean(rows,'rent'),ccu:mean(rows,'ccu'),margin:mean(rows,'margen'),profit:total(rows,'utilPesos'),units:rows.reduce((s,r)=>s+(finite(r.undM)?r.undM:finite(r.cant)?r.cant:0),0)};}
function period(rows,selection,now=new Date()){
 const current=String(now.getFullYear()),all=[...new Set(rows.map(r=>r.fecha).filter(k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(k||'')))].sort();
 const years=[...new Set((selection?.years??[current]).map(String).filter(y=>/^\d{4}$/.test(y)))].sort();
 const periods=[...new Set((selection?.periods??[]).filter(k=>/^\d{4}-(0[1-9]|1[0-2])$/.test(k)&&(!years.length||years.includes(k.slice(0,4)))))].sort();
 const available=all.filter(k=>!years.length||years.includes(k.slice(0,4)));
 const keys=periods.length?periods:available;
 const label=periods.length===1?monthLabel(periods[0]):(years.length?years.join(', '):'Todos los años')+' · '+(periods.length?periods.length+' meses':'Todos los meses');
 const currentMonth=current+'-'+String(now.getMonth()+1).padStart(2,'0');
 const anchor=periods.at(-1)||(!years.length||years.includes(current)?currentMonth:available.at(-1)||years.at(-1)+'-12');
 return {years,periods,keys,labels:keys.map(monthLabel),label,anchor,yearsAvailable:[...new Set([...all.map(k=>k.slice(0,4)),current,...years])].sort().reverse(),periodsAvailable:[...new Set([...available,...periods])].sort().reverse()};
}
function inPeriod(row,p){return (!p.years.length||p.years.includes(row.fecha?.slice(0,4)))&&(!p.periods.length||p.periods.includes(row.fecha));}
const referenceId=r=>JSON.stringify([classify(r).company,classify(r).nativeLine,String(r.ref||r.desc||'—')]);
function references(rows){
 const groups=new Map();
 for(const r of rows){const id=referenceId(r);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r);}
 return [...groups].map(([id,items])=>{const r=items.at(-1),s=summary(items);return {id,ref:r.ref||'—',desc:r.desc||'',...classify(r),linea:classify(r).nativeLine,subcat:r.subcat||'',cant:s.units,rent:s.rent,ccu:s.ccu,margen:s.margin,utilPesos:s.profit,missingProfit:items.filter(r=>!finite(r.utilPesos)).length,count:items.length,rows:items};});
}
function rankings(groups,n=10){
 const valid=groups.filter(r=>finite(r.rent)),tie=(a,b)=>a.id.localeCompare(b.id);
 const block=rows=>({rows,profit:total(rows,'utilPesos'),missingProfit:rows.reduce((s,r)=>s+r.missingProfit,0)});
 return {top:block([...valid].sort((a,b)=>b.rent-a.rent||tie(a,b)).slice(0,n)),bottom:block([...valid].sort((a,b)=>a.rent-b.rent||tie(a,b)).slice(0,n))};
}
function shiftMonth(key,offset){const d=new Date(Date.UTC(+key.slice(0,4),+key.slice(5)-1+offset,1));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');}
function windows(anchor){return {recent:[shiftMonth(anchor,-1),anchor],historical:Array.from({length:6},(_,i)=>shiftMonth(anchor,i-7))};}
const components=[
 ['tela','Telas'],['insumos','Insumos'],['corte','Corte'],['conf','Confección'],
 ['lav','Lavandería'],['bordado','Bordado / estampado'],['pres','Presentación']
];
function unitCost(row,key){
 if(key==='tela'&&row.telaRegistrada===0)return 0;
 const value=row[key];
 if(key==='insumos'){
  if(finite(value)&&row.cant>0)return value/row.cant;
  if(finite(row.insumosConf)&&finite(row.insumosPres))return row.insumosConf+row.insumosPres;
  return null;
 }
 if(!finite(value))return null;
 return value;
}
function compareComponents(historical,recent){
 return components.map(([key,label])=>{
  const average=rows=>mean(rows.map(row=>({value:unitCost(row,key)})),'value');
  const before=average(historical),after=average(recent);
  const change=finite(before)&&finite(after)?Math.round((after-before)*100)/100:null;
  return {key,label,before,after,change};
 });
}
function operationKey(company,ref,order){
 const match=String(order??'').trim().match(/^(?:OP-)?0*(\d+)(?:\.0+)?$/i);
 return match&&ref?JSON.stringify([company,norm(ref),match[1]]):null;
}
function traceIndex(lots){
 const index=new Map();
 for(const lot of lots){
  const key=operationKey(lot.empresa,lot.refSap,lot.ordenCorte);
  if(key)index.set(key,index.has(key)?null:lot);
 }
 return index;
}
const genericProviders=new Set([
 'EXTERNA','EXTERNO','EXTERNAS','EXTERNOS','INTERNA','INTERNO','INTERNAS','INTERNOS',
 'SIN REGISTRO','SIN ASIGNAR','NO APLICA','N/A','NA','-','—','0'
]);
function providerName(value){
 const name=String(value??'').trim();
 return name&&!genericProviders.has(norm(name).replace(/\s+/g,' '))?name:null;
}
function providers(row,index){
 const key=operationKey(classify(row).company,row.ref,row.lote);
 const trace=key?index.get(key)?.traza:null;
 const stages=[
  ['Corte','corte',row.corte],['Confección','confeccion',row.conf],
  ['Lavandería / tintorería','tintoreria',row.lav],['Bordado','bordado',row.bordado],
  ['Presentación','presentacion',row.pres]
 ];
 return stages.flatMap(([label,stage,cost])=>{
  const operation=trace?.[stage];
  const name=providerName(operation?.resp);
  if(name)return [{label,name}];
  const workshop=stage==='confeccion'?providerName(row.taller):null;
  if(workshop)return [{label:label+' (Costos)',name:workshop}];
  const hasStage=operation?.ini||operation?.fin||String(operation?.resp??'').trim()||
    (finite(cost)&&cost>0)||(stage==='confeccion'&&String(row.taller??'').trim());
  return hasStage?[{label,name:null}]:[];
 });
}
function variations(rows,anchor,allowedIds){
 const window=windows(anchor),groups=references(rows.filter(r=>(r.cant||0)>0&&!(r.tela===0&&r.promTela===0)&&finite(r.ct)&&r.ct>0));
 const entries=groups.filter(g=>!allowedIds||allowedIds.has(g.id)).flatMap(g=>{
  const recent=g.rows.filter(r=>window.recent.includes(r.fecha)),historical=g.rows.filter(r=>window.historical.includes(r.fecha));
  if(!recent.length||!historical.length)return [];
  const before=mean(historical,'ct'),after=mean(recent,'ct'),change=after-before,delta=change/Math.abs(before);
  return delta>1e-12?[{...g,before,after,change,delta,recentCount:recent.length,historicalCount:historical.length,recentRows:recent,historicalRows:historical}]:[];
 }).sort((a,b)=>b.delta-a.delta||a.id.localeCompare(b.id));
 return {anchor,...window,rows:entries.slice(0,5).map(row=>({...row,components:compareComponents(row.historicalRows,row.recentRows)})),comparable:entries.length};
}
const api={summary,period,inPeriod,classify,references,rankings,variations,windows,monthLabel,number,percent,providers,traceIndex};
root.PccCostModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
