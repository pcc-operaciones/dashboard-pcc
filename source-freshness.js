
(function(root){
'use strict';
const names={ops:'Operaciones',cos:'Costos',inv:'Inventario'};
const records=new Map(),contexts=new Map();
let active='ops',enabled=true;
let limits={ops:2,cos:7,inv:1};
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/[\s-]+/g,'_');
const updateKeys=['FECHA_ACTUALIZACION','FECHA_ACTUALIZACION_FUENTE','ULTIMA_ACTUALIZACION','ACTUALIZADO_EN','SOURCE_UPDATED_AT'];
const cutoffKeys=['FECHA_CORTE_DATOS','DATOS_HASTA','DATA_THROUGH'];
function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function parseDate(value){
  const v=String(value??'').trim();
  let m=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/);
  if(!m){const d=v.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);if(d)m=[v,d[3],d[2],d[1],d[4],d[5],d[6]];}
  if(!m)return null;
  const y=+m[1],mo=+m[2],day=+m[3],h=+(m[4]||0),min=+(m[5]||0),sec=+(m[6]||0);
  const check=new Date(Date.UTC(y,mo-1,day));
  if(y<1900||mo<1||mo>12||check.getUTCDate()!==day||h>23||min>59||sec>59)return null;
  let date=m[1]+'-'+m[2]+'-'+m[3],time=m[4]?m[4]+':'+m[5]:'';
  if(m[7]){
    const zoned=new Date(v);if(Number.isNaN(zoned.getTime()))return null;
    date=today(zoned);
    time=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(zoned);
  }
  return {date,key:date+(time?' '+time:''),label:date.split('-').reverse().join('/')+(time?' '+time:''),zone:time?(m[7]?'hora Colombia':'hora de origen; zona no informada'):'solo fecha'};
}
function dates(values,now=new Date()){
  const valid=[],bad=[];let missing=0;const currentDay=today(now);
  for(const v of values){
    if(v===undefined||v===null||String(v).trim()===''){missing++;continue;}
    const d=parseDate(v);
    if(!d||d.date>currentDay){bad.push(v);continue;}valid.push(d);
  }
  valid.sort((a,b)=>a.key.localeCompare(b.key));
  return {first:valid[0]||null,last:valid.at(-1)||null,missing,invalid:bad.length,count:valid.length};
}
function extract(rows,keys,now){
  for(let i=0;i<Math.min(rows.length,8);i++){
    const col=rows[i].findIndex(h=>keys.includes(norm(h)));
    if(col<0)continue;
    // También admite una celda de metadatos: etiqueta y valor a su derecha.
    if(parseDate(rows[i][col+1]))return {...dates([rows[i][col+1]],now),field:String(rows[i][col])};
    const data=rows.slice(i+1).filter(r=>r.some(v=>String(v??'').trim()));
    return {...dates(data.map(r=>r[col]),now),field:String(rows[i][col])};
  }
  return {...dates([],now),field:null};
}
function span(d){return !d.first?'No disponible':d.first.key===d.last.key?d.last.label:d.first.label+' — '+d.last.label;}
function inspect(rows,meta,now=new Date()){
  const updated=extract(rows,updateKeys,now),cutoff=extract(rows,cutoffKeys,now);
  let business='Corte de los datos no disponible',businessLabel='Datos correspondientes a';
  if(meta.group==='ops'&&meta.sheet==='KPI_ALERTAS'){
    const report=extract(rows,['FECHA'],now);
    if(report.first)business='Fecha del reporte de alertas: '+span(report);
  }
  if(meta.group==='cos'){
    const cost=extract(rows,['FECHA_COSTEO'],now);
    business=cost.first?'Costeos registrados: '+span(cost):'Fecha de costeo no disponible';
  }
  if(meta.group==='inv'&&meta.sheet==='INV_Movimientos'){
    const h=(rows[0]||[]).map(norm),yi=h.indexOf('ANO'),mi=h.indexOf('MES');
    const months=[...new Set(rows.slice(1).map(r=>{
      const y=String(r[yi]??''),m=Number(r[mi]);
      return /^\d{4}$/.test(y)&&m>=1&&m<=12?y+'-'+String(m).padStart(2,'0'):null;
    }).filter(Boolean))].sort();
    business=months.length?'Movimientos: '+months[0]+' — '+months.at(-1)+' (mes final posiblemente parcial)':'Período de movimientos no disponible';
  }
  if(cutoff.first)business='Corte informado por la fuente: '+span(cutoff);
  return {updated,cutoff,business,businessLabel};
}
function state(rec,now=new Date()){
  if(rec.state==='error')return 'Error de consulta';
  if(rec.state==='loading')return 'Consultando';
  if(rec.state==='empty')return 'Sin registros';
  const u=rec.updated;
  if(!u?.first)return 'Fecha no disponible';
  const age=Math.floor((Date.parse(today(now))-Date.parse(u.first.date))/86400000);
  return age>limits[rec.group]?'Atrasado':u.invalid||u.missing?'Fecha incompleta':'Vigente';
}
function summary(list,now=new Date()){
  const known=list.filter(r=>r.updated?.first);
  const stamps=known.flatMap(r=>[r.updated.first,r.updated.last]).sort((a,b)=>a.key.localeCompare(b.key));
  const unknown=list.filter(r=>!r.updated?.first||r.updated.missing||r.updated.invalid).length;
  const statuses=list.map(r=>state(r,now));
  const status=statuses.includes('Error de consulta')?'Fuentes con error':statuses.includes('Consultando')?'Consultando fuentes':statuses.includes('Atrasado')?'Hay fuentes atrasadas':unknown?'Fechas por confirmar':statuses.includes('Sin registros')?'Fuentes sin registros':list.length?'Vigente':'Pendiente de consulta';
  const label=!stamps.length?'Actualización de la fuente no disponible':stamps[0].key===stamps.at(-1).key?stamps[0].label:stamps[0].label+' — '+stamps.at(-1).label;
  return {status,label,unknown,different:stamps.length>1&&stamps[0].key!==stamps.at(-1).key};
}
function track(key,rows,phase,meta={}){
  if(!meta.group)return;
  const old=records.get(key);
  const rec={...old,...meta,key,state:phase,queriedAt:new Date()};
  if(phase==='ok'||phase==='empty')Object.assign(rec,inspect(rows,meta));
  records.set(key,rec);render();
}
function detail(key,values){const r=records.get(key);if(r)Object.assign(r,values);render();}
function setContext(group,value){if(contexts.get(group)===value)return;contexts.set(group,value);if(active===group)render();}
function configure(config={}){for(const g of Object.keys(names)){const n=config.maxDiasSinActualizar?.[g];if(Number.isFinite(n)&&n>=0)limits[g]=n;}render();}
async function readConfig(){try{const r=await fetch('./config.json',{cache:'no-store'});if(r.ok)configure((await r.json()).vigencia);}catch{}}
function show(group){active=group;enabled=group!=='gg'&&(group!=='inv'||!root.document?.getElementById('gerencia-bar'));render();}
function el(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function render(){
 if(!root.document||!document.body)return;
 root.PccExecutive?.refresh();
 try{if(root.parent!==root)root.parent.PccExecutive?.refresh();}catch{}
 let box=document.getElementById('pcc-freshness');
 if(!box){box=el('section',undefined,'pcc-freshness');box.id='pcc-freshness';box.setAttribute('aria-label','Vigencia de los datos');const anchor=document.getElementById('gerencia-bar')||document.querySelector('.topbar');if(anchor)anchor.after(box);else document.body.prepend(box);}
 box.hidden=!enabled;
 const quality=document.getElementById('pcc-data-quality');if(quality&&document.getElementById('gerencia-bar'))quality.hidden=active!=='ops';
 if(!enabled)return;
 const expanded=box.querySelector('details')?.open||false;
 const list=[...records.values()].filter(r=>r.group===active);
 const s=summary(list);
 box.replaceChildren();
 const details=el('details');details.open=expanded;
 const compact=el('summary',undefined,'pcc-fresh-summary');
 compact.append(el('span','Vigencia','pcc-fresh-title'),el('span',s.label==='Actualización de la fuente no disponible'?'Fecha del origen no disponible':'Origen: '+s.label,'pcc-fresh-date'));
 const statuses={'Fuentes con error':'Fuentes incompletas','Hay fuentes atrasadas':'Con atraso','Fechas por confirmar':'Por confirmar','Consultando fuentes':'Consultando','Fuentes sin registros':'Sin registros','Pendiente de consulta':'Pendiente'};
 compact.append(el('span',statuses[s.status]||s.status,'pcc-fresh-status'));
 if(s.unknown)compact.append(el('span',s.unknown+' sin fecha completa','pcc-fresh-count'));
 const more=el('span',undefined,'pcc-fresh-more');more.append(el('span','Ver detalle','pcc-fresh-closed'),el('span','Ocultar detalle','pcc-fresh-open'));compact.append(more);
 details.append(compact);
 details.append(el('h2','Vigencia de los datos · '+names[active],'pcc-fresh-heading'));
 box.dataset.state=s.status==='Vigente'?'ok':s.status==='Hay fuentes atrasadas'||s.status==='Fuentes con error'?'error':'unknown';
 const info=el('div',undefined,'pcc-fresh-info');
 const update=el('div');update.append(el('span','Fuentes actualizadas','pcc-fresh-label'),el('strong',s.label));
 if(s.different)update.append(el('small','Las fuentes tienen fechas distintas.'));
 if(s.unknown)update.append(el('small',s.unknown+' de '+list.length+' fuentes sin fecha completa verificable.'));
 const data=el('div');data.append(el('span','Datos correspondientes a','pcc-fresh-label'));
 const context=contexts.get(active);
 if(context)data.append(el('strong',context));
 else if(active==='inv'){
   const stock=list.filter(r=>['INV_Resumen','INV_Bodegas'].includes(r.sheet));
   const cutComplete=stock.length===2&&stock.every(r=>r.cutoff?.first&&!r.cutoff.missing&&!r.cutoff.invalid);
   const cuts=stock.flatMap(r=>r.cutoff?.first?[r.cutoff.first,r.cutoff.last]:[]).sort((a,b)=>a.key.localeCompare(b.key));
   data.append(el('strong',cutComplete?'Existencias: '+span({first:cuts[0],last:cuts.at(-1)}):'Existencias: corte no informado o incompleto'));
   const mov=list.find(r=>r.sheet==='INV_Movimientos');if(mov)data.append(el('small',mov.business));
 }else data.append(el('strong',active==='ops'?'Período pendiente de configuración':'Período pendiente de carga'));
 info.append(update,data);details.append(info);
 const wrap=el('div',undefined,'pcc-fresh-scroll'),table=el('table');
 const header=el('tr');for(const t of ['Fuente','Actualización del origen','Corte / último registro','Estado'])header.append(el('th',t));
 const thead=el('thead');thead.append(header);table.append(thead);
 const body=el('tbody');
 for(const r of list){
   const tr=el('tr'),source=el('td',r.label||r.sheet),date=el('td',span(r.updated||{})),biz=el('td',r.business||'Sin fecha de datos disponible'),status=el('td',state(r));
   if(r.updated?.first){date.append(el('small',r.updated.field+' · '+r.updated.last.zone));}
   if(r.updated?.missing||r.updated?.invalid)date.append(el('small',(r.updated.missing||0)+' registros sin fecha; '+(r.updated.invalid||0)+' fechas inválidas o futuras.'));
   if(r.state==='error'||r.state==='loading')date.append(el('small','Fechas de la última lectura correcta, si existen.'));
   if(r.queriedAt)source.append(el('small','Consultado: '+r.queriedAt.toLocaleString('es-CO',{timeZone:'America/Bogota'})+' · Colombia'));
   if(r.state==='error'&&r.message)status.append(el('small',r.message));
   tr.append(source,date,biz,status);body.append(tr);
 }
 table.append(body);wrap.append(table);details.append(wrap);
 details.append(el('p','Vigente: todas las fuentes con fecha verificable dentro de '+limits[active]+' día(s) calendario. Umbral configurable. Un último registro no certifica que el período esté completo.','pcc-fresh-foot'));
 if(root.PCC_REVIEW)details.append(el('p','Vista de comparación: respuestas de fuentes capturadas localmente. Actualizar vuelve a leer esa captura.','pcc-fresh-foot'));
 if(quality)details.append(quality);
 box.append(details);
}
const api={parseDate,dates,inspect,state,summary,track,detail,setContext,configure,readConfig,show,records,refresh:render};
root.PccFresh=api;if(typeof module!=='undefined')module.exports=api;
if(root.document)document.addEventListener('DOMContentLoaded',()=>{if(!document.getElementById('gerencia-bar')&&document.querySelector('.topbar')){active='inv';readConfig();}render();});
})(typeof window!=='undefined'?window:globalThis);
