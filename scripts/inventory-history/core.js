/* Portable inventory import rules. No Drive access or writes in this module. */
(function(root){
'use strict';
const VERSION=1, DAY=86400000;
const text=v=>String(v??'').trim();
const norm=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function requireValue(ok,message){if(!ok)throw new Error(message);}
function date(value){
 let v=text(value),m=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00:00(?:\.000)?)?$/);
 if(!m){const d=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(d)m=['',d[3],d[2].padStart(2,'0'),d[1].padStart(2,'0')];}
 requireValue(m,'Fecha no válida: '+v);
 const key=m[1]+'-'+m[2]+'-'+m[3],dt=new Date(key+'T00:00:00Z');
 requireValue(Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===key,'Fecha no válida: '+v);return key;
}
function number(v,label){
 requireValue(v!==null&&v!==undefined&&v!=='','Falta número: '+label);
 requireValue(typeof v==='number'||/^[+-]?\d+(?:\.\d+)?$/.test(text(v)),'Formato numérico ambiguo: '+label);
 const n=Number(v);requireValue(Number.isFinite(n),'Número no válido: '+label);return n;
}
function table(rows,required){
 requireValue(Array.isArray(rows)&&rows.length>0,'Archivo sin encabezado');
 const h=rows[0].map(norm);const idx={};
 for(const name of required){const key=norm(name),found=h.reduce((a,v,i)=>v===key?a.concat(i):a,[]);requireValue(found.length===1,'Columna ausente o repetida: '+name);idx[name]=found[0];}
 return {data:rows.slice(1).map((row,i)=>({row,index:i+2})).filter(x=>x.row.some(v=>text(v)!=='')),get:(r,k)=>r[idx[k]],has:k=>h.includes(norm(k)),optional:(r,k)=>r[h.indexOf(norm(k))]};
}
const STOCK_FIELDS=['Referencia','Desc. item','Detalle ext. 2','Detalle ext. 1','Bodega','Existencia','Cant. comprometida','Cant. disponible'];
const MOVE_FIELDS=['Referencia','Detalle ext. 2','Detalle ext. 1','Bodega','Fecha','Tipo docto.','Entradas (inv.)','Salidas (inv.)','Neto (inv.)','Costo entradas (prom.)','Costo salidas (prom.)','Costo neto (prom.)'];
const key=r=>JSON.stringify([r.company,r.ref,r.size,r.color,r.warehouse]);
function sku(t,row,company,index){
 const r={company,ref:text(t.get(row,'Referencia')),size:text(t.get(row,'Detalle ext. 2')),color:text(t.get(row,'Detalle ext. 1')),warehouse:text(t.get(row,'Bodega')),sourceRow:index};
 requireValue(r.ref&&r.warehouse,'Referencia o bodega ausente, fila '+index);return r;
}
function inventory(rows,company,cutoff){
 cutoff=date(cutoff);const t=table(rows,STOCK_FIELDS),seen=new Set(),warnings=[];
 for(const name of ['Precio unitario','Costo prom. unit. (ins)'])requireValue(rows[0].map(norm).filter(h=>h===norm(name)).length<=1,'Columna repetida: '+name);
 const records=t.data.map(({row,index})=>{
  const r=sku(t,row,company,index);r.cutoff=cutoff;r.description=text(t.get(row,'Desc. item'));
  r.units=number(t.get(row,'Existencia'),'existencia fila '+index);r.committed=number(t.get(row,'Cant. comprometida'),'comprometida fila '+index);r.available=number(t.get(row,'Cant. disponible'),'disponible fila '+index);
  requireValue(Math.abs(r.units-r.committed-r.available)<0.00001,'Existencia no concilia, fila '+index);
  requireValue(!seen.has(key(r)),'SKU duplicado en inventario, fila '+index);seen.add(key(r));
  if(r.units<0)warnings.push('Existencia negativa en fila '+index);
  const cost=name=>{const v=t.optional(row,name);if(v===null||v===undefined||text(v)==='')return null;const n=number(v,name+' fila '+index);requireValue(n>=0,'Costo negativo en fila '+index);return n;};
  r.erpPrice=cost('Precio unitario');r.erpAverageCost=cost('Costo prom. unit. (ins)');
  r.unitCost=r.erpPrice>0?r.erpPrice:r.erpAverageCost>0?r.erpAverageCost:null;
  r.costSource=r.erpPrice>0?'PRECIO_UNITARIO':r.erpAverageCost>0?'COSTO_PROMEDIO':'SIN_COSTO';
  r.valuationVersion=1;
  r.value=r.unitCost===null?null:Math.round((r.units*r.unitCost+Number.EPSILON)*100)/100;
  // No cost from movements is substituted for a missing stock valuation.
  r.age=null;return r;
 });return {records,warnings};
}
function movements(rows,company,from,to){
 from=date(from);to=date(to);requireValue(from<=to,'Período invertido');
 const t=table(rows,MOVE_FIELDS);const seen=new Set(),warnings=[];
 const records=t.data.map(({row,index})=>{
  const r=sku(t,row,company,index);r.date=date(t.get(row,'Fecha'));requireValue(r.date>=from&&r.date<=to,'Movimiento fuera del período declarado, fila '+index);
  r.type=text(t.get(row,'Tipo docto.'));requireValue(r.type,'Tipo de documento ausente, fila '+index);
  r.in=number(t.get(row,'Entradas (inv.)'),'entradas fila '+index);r.out=number(t.get(row,'Salidas (inv.)'),'salidas fila '+index);r.net=number(t.get(row,'Neto (inv.)'),'neto fila '+index);
  r.costIn=number(t.get(row,'Costo entradas (prom.)'),'costo entradas fila '+index);r.costOut=number(t.get(row,'Costo salidas (prom.)'),'costo salidas fila '+index);r.costNet=number(t.get(row,'Costo neto (prom.)'),'costo neto fila '+index);
  requireValue(Math.abs(r.in-r.out-r.net)<0.00001,'Cantidades del movimiento no concilian, fila '+index);
  requireValue(Math.abs(r.costIn-r.costOut-r.costNet)<=0.021,'Costos del movimiento no concilian, fila '+index);
  r.unitCostIn=r.in>0?r.costIn/r.in:null;r.unitCostOut=r.out>0?r.costOut/r.out:null;
  // Document types never discard the incoming or outgoing side of a row.
  r.document=text(t.optional(row,'Numero documento'));r.documentLine=text(t.optional(row,'Linea documento'));
  if(r.document&&r.documentLine){r.transactionKey=JSON.stringify([company,r.type,r.document,r.documentLine]);requireValue(!seen.has(r.transactionKey),'Documento y línea duplicados, fila '+index);seen.add(r.transactionKey);}else r.transactionKey=null;
  return r;
 });if(records.some(r=>!r.transactionKey))warnings.push('Sin documento y línea: conservar filas y sustituir períodos completos; no deduplicar por SKU/fecha.');
 return {records,warnings};
}
function metadata(name,description,hash){
 let d={};if(text(description)){try{d=JSON.parse(description).pcc||{};}catch{d={};}}
 if(d.sha256){requireValue(d.sha256===hash,'Los metadatos pertenecen a otra versión del Excel');return d;}
 const cut=name.match(/\bcorte[ _-]+(\d{4}-\d{2}-\d{2})/i);
 const period=name.match(/\bdesde[ _-]+(\d{4}-\d{2}-\d{2})[ _-]+hasta[ _-]+(\d{4}-\d{2}-\d{2})/i);
 // Without a hash binding, persistent Drive descriptions cannot certify a new upload.
 return cut?{cutoff:date(cut[1]),origin:'filename'}:period?{from:date(period[1]),to:date(period[2]),complete:false,origin:'filename'}:{};
}
function prepare(files,options){
 const opt=options||{},today=date(opt.today),roles=['invEU','invTEX','movEU','movTEX'];
 for(const role of roles)requireValue(files[role]&&files[role].hash,'Falta archivo: '+role);
 const cutEU=date(files.invEU.meta.cutoff),cutTEX=date(files.invTEX.meta.cutoff);
 requireValue(cutEU===cutTEX,'EU y TEX tienen cortes de inventario diferentes');requireValue(cutEU<=today,'Corte futuro');
 requireValue(!opt.startCutoff||cutEU>=date(opt.startCutoff),'El corte es anterior al inicio del histórico');
 const stocks=[],moves=[],coverage=[],warnings=[];
 for(const company of ['EU','TEX']){
  const inv=files['inv'+company],mov=files['mov'+company],from=date(mov.meta.from),to=date(mov.meta.to);
  requireValue(from<=to&&to<=cutEU,'Los movimientos exceden el corte de '+company);
  for(const file of [inv,mov]){
   const count=table(file.rows,[]).data.length;
   if(opt.rowLimit)requireValue(count<opt.rowLimit,'Posible límite de exportación alcanzado: '+company);
   if(file.meta.expectedRows!==undefined)requireValue(count===file.meta.expectedRows,'Cantidad de filas distinta al control ERP: '+company);
  }
  const a=inventory(inv.rows,company,cutEU),b=movements(mov.rows,company,from,to);
  stocks.push(...a.records);moves.push(...b.records);warnings.push(...a.warnings,...b.warnings);
  coverage.push({company,from,to,complete:mov.meta.complete===true});
  if(mov.meta.complete!==true)warnings.push(company+': cobertura exportada pendiente de verificar');
 }
 return {version:VERSION,valuationVersion:1,cutoff:cutEU,inventoryComplete:files.invEU.meta.complete===true&&files.invTEX.meta.complete===true,inventory:stocks,movements:moves,coverage,warnings:[...new Set(warnings)],totals:totals(stocks),sources:roles.map(role=>({role,hash:files[role].hash,meta:files[role].meta}))};
}
function totals(rows){
 const result={EU:{units:0,committed:0,available:0,value:0,missingValue:0},TEX:{units:0,committed:0,available:0,value:0,missingValue:0}};for(const r of rows){const t=result[r.company]||(result[r.company]={units:0,committed:0,available:0,value:0,missingValue:0});t.units+=r.units;t.committed+=r.committed;t.available+=r.available;if(r.value===null)t.missingValue++;else t.value+=r.value;}
 for(const t of Object.values(result))if(t.missingValue)t.value=null;return result;
}
function shift(dateKey,days){return new Date(new Date(dateKey+'T00:00:00Z').getTime()+days*DAY).toISOString().slice(0,10);}
function monthEnd(month){return new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).toISOString().slice(0,10);}
function covers(ranges,company,start,end){
 let cursor=start;for(const r of ranges.filter(r=>r.company===company&&r.complete).sort((a,b)=>a.from.localeCompare(b.from))){if(r.to<cursor)continue;if(r.from>cursor)return false;cursor=shift(r.to,1);if(cursor>end)return true;}return false;
}
function monthlyStatus(batch,startCutoff){
 const month=batch.cutoff.slice(0,7),start=month+'-01',end=monthEnd(month);
 if(batch.cutoff!==end)return 'EN_CURSO';
 if(startCutoff>start)return 'PRIMER_MES_PARCIAL';
 if(!batch.inventoryComplete||!['EU','TEX'].every(c=>covers(batch.coverage,c,start,end)))return 'CIERRE_PENDIENTE_COBERTURA';
 return 'CIERRE_EXISTENCIAS'; // Does not certify cost or age metrics.
}
function mergeMovements(previous,batch){
 let rows=previous.slice();for(const cov of batch.coverage){if(!cov.complete)continue;
  rows=rows.filter(r=>!(r.company===cov.company&&r.date>=cov.from&&r.date<=cov.to));
  rows.push(...batch.movements.filter(r=>r.company===cov.company&&r.date>=cov.from&&r.date<=cov.to));
 }return rows;
}
function accept(state,batch,id,processedAt){
 const s=state||{version:VERSION,startCutoff:batch.cutoff,current:null,loads:[],months:{}};
 requireValue(batch.cutoff>=s.startCutoff,'El corte es anterior al inicio del histórico');
 if(s.loads.some(l=>l.id===id))return s;
 const next=JSON.parse(JSON.stringify(s));const entry={id,cutoff:batch.cutoff,processedAt,usableInventory:batch.inventoryComplete,totals:batch.totals,warnings:batch.warnings,status:monthlyStatus(batch,s.startCutoff)};
 next.loads.push(entry);if(entry.usableInventory&&(!next.current||entry.cutoff>=next.current.cutoff))next.current=entry;
 const month=batch.cutoff.slice(0,7),old=next.months[month];
 if(!old||(entry.cutoff>=old.cutoff&&!(old.status==='CIERRE_EXISTENCIAS'&&entry.status!=='CIERRE_EXISTENCIAS')))next.months[month]=entry;
 return next;
}
const api={VERSION,date,number,inventory,movements,metadata,prepare,totals,covers,monthlyStatus,mergeMovements,accept};
root.PccInventoryHistory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
