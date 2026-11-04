(function(root){
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const company=s=>norm(s).includes('TEX')?'TEX':norm(s)==='EU'?'EU':'';
const hierarchy=[{company:'TEX',line:'TEXSION',cats:['EVA','LAXO','DISNEY','DOTACIÓN']},{company:'EU',line:'EU',cats:['EU Línea','EU Moda']},{company:'EU',line:'YETRO',cats:['YETRO']},{company:'EU',line:'TWO&TWO',cats:['TWO&TWO']}];
const stageFields=['fProg','fCorte','fConf','fTint','fPres'];
const stageNames=['Planeación','Corte','Confección','Tintorería','Presentación'];
const processNames={CORTE:'Corte',EU:'EU Línea',MODA:'EU Moda',TEX:'Costura TEX',SERV:'Servicios especiales',PRES:'Pres. TEX',PREU:'Pres. EU',PREU2:'Pres. EU2 Línea'};
function performanceDetail(mods,key,supported,calculate){
 const lastDay=key?new Date(Date.UTC(+key.slice(0,4),+key.slice(5,7),0)).getUTCDate():0;
 const days=supported?[...new Set(mods.flatMap(m=>(m.daily||[]).map(d=>Number(d.dia))).filter(d=>Number.isInteger(d)&&d>=1&&d<=lastDay))].sort((a,b)=>a-b):[];
 const processIds=[...Object.keys(processNames),...new Set(mods.map(m=>m.pk).filter(pk=>pk&&!processNames[pk]))];
 const metric=(field,meta)=>({meta,
  values:days.map(day=>calculate?.(mods.map(m=>({...m,daily:(m.daily||[]).filter(d=>Number(d.dia)===day)})),field)??null),
  processes:supported?processIds.map(id=>({id,name:processNames[id]||id,value:calculate?.(mods.filter(m=>m.pk===id),field)??null})).filter(p=>finite(p.value)):[]
 });
 return {days,efficiency:metric('ef',.75),compliance:metric('cumpl',1)};
}
const monthNames=['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'];
const stateOrder=['RETENIDO/INSUMOS','PLANEACION','CORTE','ESTAMPADO','BORDADO','CORTADO','CONFECCION','CONFECCIONADO','TINTORERIA','ESTAMPADO CONFECCIONADO','BORDADO CONFECCIONADO','NO CONFORME','COSTEO','PRESENTACION POR INSUMOS','PRESENTACION','PENDIENTE POR FICHA'];
function taxonomy(co,raw,description,inventory=false){
 const s=norm(raw),d=norm(description);let line=co==='TEX'?'TEXSION':co==='EU'?'EU':'Sin clasificar',cats=[];
 if(/YETRO/.test(s)){line='YETRO';cats=['YETRO'];}
 else if(/TWO|TYT/.test(s)){line='TWO&TWO';cats=['TWO&TWO'];}
 else if(co==='EU'){
  if(/MODA|NEW|NUEV/.test(s))cats=['EU Moda'];
  else if(/LINEA|BASICO|LIQUID|DOTAC/.test(s))cats=['EU Línea'];
 }else if(co==='TEX'){
  if(s==='EVA')cats=['EVA'];if(s==='LAXO')cats=['LAXO'];if(s==='DISNEY')cats=['DISNEY'];if(/DOTAC/.test(s))cats=['DOTACIÓN'];
  // Misma clasificación por descripción que los filtros del Inventario PT.
  if(inventory){cats=[];if(/DISNEY|MICKEY|MINNIE|FROZEN|MARVEL|CARS|SNOOPY|KUROM|HELLO KIT|SANRIO|JURASSIC|SPIDER/.test(d))cats.push('DISNEY');if(d.includes('EVA'))cats.push('EVA');if(d.includes('LAXO'))cats.push('LAXO');if(/DOTAC|UNIFORME/.test(d))cats.push('DOTACIÓN');}
 }
 return {company:co,line,cats};
}
function cleanFilters(value={}){
 const f={company:[...new Set((Array.isArray(value.company)?value.company:[]).filter(x=>['EU','TEX'].includes(x)))],line:[],category:[]};
 const allowed=hierarchy.filter(h=>!f.company.length||f.company.includes(h.company));
 f.line=[...new Set((Array.isArray(value.line)?value.line:[]).filter(x=>allowed.some(h=>h.line===x)))];
 f.category=[...new Set((Array.isArray(value.category)?value.category:[]).filter(x=>allowed.some(h=>(!f.line.length||f.line.includes(h.line))&&h.cats.includes(x))))];return f;
}
function matches(r,f){return (!f.company.length||f.company.includes(r.company))&&(!f.line.length||f.line.includes(r.line))&&(!f.category.length||r.cats.some(c=>f.category.includes(c)));}
const sum=(rows,key)=>rows.reduce((s,r)=>s+(finite(r[key])?r[key]:0),0);
const mean=(rows,key)=>{const valid=rows.filter(r=>finite(r[key]));return valid.length?sum(valid,key)/valid.length:null;};
function monthsBetween(from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)return [];
 const result=[];let y=+from.slice(0,4),m=+from.slice(5,7);while(y+'-'+String(m).padStart(2,'0')<=to.slice(0,7)&&result.length<120){result.push(y+'-'+String(m).padStart(2,'0'));if(++m>12){m=1;y++;}}return result;
}
function movementSeries(rows,from,to,entryKey,exitKey,dateKey){
 const keys=monthsBetween(from,to);return {keys,labels:keys.map(key=>monthNames[+key.slice(5)-1]+(key.slice(0,4)!==to.slice(0,4)?' '+key.slice(0,4):'')+((key===from.slice(0,7)&&from.slice(8)!=='01')||(key===to.slice(0,7)&&+to.slice(8)!==new Date(Date.UTC(+to.slice(0,4),+to.slice(5,7),0)).getUTCDate())?'*':'')),received:keys.map(k=>sum(rows.filter(r=>String(r[dateKey]).slice(0,7)===k),entryKey)),shipped:keys.map(k=>sum(rows.filter(r=>String(r[dateKey]).slice(0,7)===k),exitKey)),from,to};
}
function build(input,filterValue={},deps={}){
 const filters=cleanFilters(filterValue),key=deps.period?.(input.config)||null,year=key?.slice(0,4),monthCount=key?+key.slice(5):0,months=monthNames.slice(0,monthCount),keys=months.map((_,i)=>year+'-'+String(i+1).padStart(2,'0'));
 const scoped=filters.company.length===1||!!(filters.line.length||filters.category.length),match=r=>matches(r,filters);
 const ready=s=>s?.status==='ready',state=s=>s?.status||'loading';
 const rawCosts=ready(input.cos)?input.cos.rows||[]:[];
 const identities=new Map();
 const costs=rawCosts.map(r=>{const tax=taxonomy(company(r.empresa),r.subcat||r.linea),identity=JSON.stringify([tax.company,r.fecha,r.ref,r.lote??null]),occurrence=identities.get(identity)||0;identities.set(identity,occurrence+1);return {...r,...tax,id:'cost-'+encodeURIComponent(identity)+'-'+occurrence,sourceCategory:r.subcat||''};}).filter(match);
 const selected=key?costs.filter(r=>r.fecha===key):[],validRent=selected.filter(r=>finite(r.rent));
 const costReady=ready(input.cos)&&!!key;
 const cos={status:state(input.cos),ready:costReady,count:costReady?selected.length:null,rent:costReady?mean(selected,'rent'):null,ccu:costReady?mean(selected,'ccu'):null,margin:costReady?mean(selected,'margen'):null,negative:costReady&&validRent.length?validRent.filter(r=>r.rent<0):[],negativeCount:costReady&&validRent.length?validRent.filter(r=>r.rent<0).length:null,rows:selected,monthly:keys.map(k=>{const rs=costs.filter(r=>r.fecha===k);return {rent:mean(rs,'rent'),ccu:mean(rs,'ccu'),margin:mean(rs,'margen')};}),records:input.cos?.records||[]};
 const wipReady=ready(input.wip),wipUnsupported=filters.category.some(x=>hierarchy[0].cats.includes(x));
 const allLots=wipReady?(input.wip.all||[]).map(r=>({...r,...taxonomy(r.empresa,r.empresa==='TEX'?r.mundo:r.clasificacion)})).filter(match):[];
 const lots=allLots.filter(r=>r.estado&&!['ENTREGADO','CANCELADO'].includes(r.estado)&&r.cant>0);
 const states=[...new Set(lots.map(r=>r.estado))].sort((a,b)=>(stateOrder.indexOf(a)<0?99:stateOrder.indexOf(a))-(stateOrder.indexOf(b)<0?99:stateOrder.indexOf(b))).map(name=>{const rows=lots.filter(r=>r.estado===name);return {name,lots:rows.length,units:sum(rows,'cant')};});
 const ops={status:state(input.ops),wipStatus:state(input.wip),ready:ready(input.ops)&&!!key,wipReady:wipReady&&!wipUnsupported,performanceSupported:!scoped,wipSupported:!wipUnsupported,lots,wipUnits:wipReady&&!wipUnsupported?sum(lots,'cant'):null,states,stages:stageNames.map((name,i)=>({name,values:keys.map(k=>wipReady&&!wipUnsupported?sum(allLots.filter(r=>r[stageFields[i]]===k),'cant'):null)})),efficiency:ready(input.ops)&&key&&!scoped?deps.ops?.(input.ops.mods||[],'ef')??null:null,compliance:ready(input.ops)&&key&&!scoped?deps.ops?.(input.ops.mods||[],'cumpl')??null:null,records:input.ops?.records||[]};
 ops.performance=performanceDetail(input.ops?.mods||[],key,ops.ready&&ops.performanceSupported,deps.ops);
 const invReady=ready(input.inv);
 const inventory=invReady?(input.inv.rows||[]).map(r=>({...r,...taxonomy(company(r.empresa),r.lineaReal||r.linea,r.desc,true)})).filter(match):[];
 const principal=inventory.filter(r=>!r.esSeg&&!r.esCobros);
 const units=r=>finite(r.totalUds)?r.totalUds:['u0','u1','u2','u3'].reduce((s,k)=>s+(finite(r[k])?r[k]:0),0);
 const missing=inventory.reduce((s,r)=>s+(finite(r.missingCostUnits)?r.missingCostUnits:Math.abs(units(r))),0);
 const known=inventory.reduce((s,r)=>s+(finite(r.knownValue)?r.knownValue:0),0);
 const taxonomyByRef=new Map((input.inv?.rows||[]).map(r=>[JSON.stringify([r.empresa,r.ref]),r.lineaReal||r.linea]));
 const moves=invReady?(input.inv.movements||[]).map(r=>({...r,...taxonomy(company(r.empresa),taxonomyByRef.get(JSON.stringify([r.empresa,r.ref]))||r.linea,r.desc,true),received:r.tipo==='EOP'&&finite(r.entradas)?r.entradas:0,shipped:r.tipo==='RM'&&finite(r.salidas)?r.salidas:0})).filter(r=>['EOP','RM'].includes(r.tipo)&&match(r)):[];
 const range=input.inv?.period||{},from=range.from||range.start||'',to=range.to||range.end||'';
 const inv={status:state(input.inv),ready:invReady,rows:inventory,principalRows:principal,units:invReady?inventory.reduce((s,r)=>s+units(r),0):null,principal:invReady?principal.reduce((s,r)=>s+units(r),0):null,age:['u0','u1','u2','u3'].map(k=>invReady?sum(principal,k):null),knownValue:invReady?known:null,missingCostUnits:invReady?missing:null,cutoff:input.inv?.cutoff||'',movements:movementSeries(moves,from,to,'received','shipped','fecha'),records:input.inv?.records||[]};
 inv.agedShare=inv.principal>0?inv.age[3]/inv.principal:null;
 const logReady=ready(input.log),logSupported=!filters.line.length&&!filters.category.length;
 const logRows=logReady?(input.log.stock||[]).filter(r=>!filters.company.length||filters.company.includes(r.company)):[];
 const logAge=logReady?(input.log.age||[]).filter(r=>!filters.company.length||filters.company.includes(r.company)):[];
 const logMoves=logReady?(input.log.moves||[]).filter(r=>!filters.company.length||filters.company.includes(r.company)):[];
 const meta=input.log?.meta||{},ageReady=logReady&&input.log.ageReady;
 const log={status:state(input.log),supported:logSupported,ready:logReady&&logSupported,ageReady:ageReady&&logSupported,meta,rows:logRows,ageRows:logAge,ageMessage:input.log?.ageMessage||'',error:input.log?.error||'',total:logReady&&logSupported?sum(logRows,'costTotal'):null,aged:ageReady&&logSupported?sum(logAge,'riskValue'):null,unknown:ageReady&&logSupported?logAge.reduce((s,r)=>s+(r.values?.[4]||0),0):null,warehouses:['MT001','MT002'].map(warehouse=>({warehouse,name:warehouse==='MT001'?'Telas':'Insumos',value:logReady&&logSupported?sum(logRows.filter(r=>r.warehouse===warehouse),'costTotal'):null})),byCompany:['EU','TEX'].map(co=>({company:co,value:sum(logRows.filter(r=>r.company===co),'costTotal')})),movements:movementSeries(logMoves,meta.movimientos_desde||'',meta.movimientos_hasta||'','inCost','outCost','date')};
 return {key,year,months,keys,label:key?input.config.mes+' '+year:'Período no configurado',filters,scoped,ops,cos,inv,log};
}
const api={build,cleanFilters,matches,taxonomy,hierarchy,monthsBetween,monthNames};root.PccAtlasModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
