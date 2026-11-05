(()=>{
'use strict';
const M=window.PccAtlasModel,root=document.createElement('div'),page=document.getElementById('page-general');
root.id='pcc-atlas';
// La agenda anterior permanece accesible, con su almacenamiento y acciones originales.
const legacy=document.createElement('div');legacy.hidden=true;
const management=document.createElement('details');management.className='atlas-management';
const summary=document.createElement('summary');summary.textContent='Alertas y seguimiento de compromisos';management.append(summary);
for(const child of [...page.children]){
 if(child.matches('.gg-heading')||child.querySelector('#gg-metrics,#gg-areas'))legacy.append(child);
 else management.append(child);
}
page.replaceChildren(root,management,legacy);
root.innerHTML='<div class="ax-app"><main class="ax-main"><div class="ax-heading"><div><span class="ax-eyebrow">DIRECCIÓN DE LA EMPRESA · PCC</span><h1 tabindex="-1">Gerencia General</h1><p class="ax-heading-note">Resultados clave y evolución de la empresa</p></div><button type="button" class="ax-source" data-sources>Fechas y fuentes ↗</button></div><div class="ax-global-filters" aria-label="Filtros de Gerencia General" data-filters></div><p class="ax-filter-scope" data-scope aria-live="polite"></p><div class="ax-area-grid" data-areas></div><footer class="ax-footer"><span>Clic en un KPI o gráfico para ampliar · Escape para volver</span><span data-period></span></footer></main></div><dialog class="ax-dialog" aria-labelledby="atlas-dialog-title"><div class="ax-modal-head"><div><span class="ax-modal-eyebrow" data-modal-area></span><h2 id="atlas-dialog-title"></h2></div><button type="button" class="ax-close" data-close aria-label="Cerrar vista ampliada">×</button></div><p class="ax-modal-scope" data-modal-scope></p><div class="atlas-cost-period" data-cost-period hidden></div><div class="ax-modal-kpis" data-modal-kpis></div><div class="ax-modal-controls"><label>Vista<select data-view aria-label="Vista ampliada"></select></label><label data-order-label>Orden<select data-order aria-label="Orden de los estados"><option value="flow">Orden del flujo</option><option value="volume">Mayor volumen</option></select></label><label data-material-label>Materiales<select data-material aria-label="Materiales"><option value="all">Telas + insumos</option><option value="MT001">Telas</option><option value="MT002">Insumos</option></select></label></div><div class="ax-enlarged" data-enlarged></div><div class="ax-large-legend" data-large-legend></div><p class="ax-modal-note" data-note></p></dialog>';
const $=s=>root.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite,integer=new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}),decimal=new Intl.NumberFormat('es-CO',{maximumFractionDigits:1}),precise=new Intl.NumberFormat('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=v=>finite(v)?integer.format(v):'—',pct=v=>finite(v)?decimal.format(v*100)+'%':'—',cash=v=>finite(v)?'$ '+integer.format(v):'—',money=v=>finite(v)?'$ '+decimal.format(v/1e6)+' M':'—',exact=v=>finite(v)?'$ '+precise.format(v):'—';
const colors=['#6b8fd4','#17b6a2','#cc9748','#9a6cd0','#239bb5'];
const areaNames={ops:'Operaciones PCC',cos:'Costos',inv:'Inventario PT',log:'Logística',sales:'Ventas',people:'Talento Humano'};
const views={ops:[['stages','Unidades mensuales por etapa'],['wip','Producto en proceso por estado'],['performance','Eficiencia y cumplimiento']],cos:[['cost','Rentabilidad y CCU sin IVA'],['margin','Margen promedio mensual'],['negative','Costeos negativos'],['ranking','10 mayores y 10 menores rentabilidades'],['variation','5 mayores variaciones del costo total']],inv:[['invflow','Recibidas vs. despachadas'],['invage','Antigüedad del inventario principal'],['invvalue','Costo y cobertura de valoración']],log:[['logflow','Entradas y salidas mensuales'],['stock','Existencias de telas e insumos'],['logage','Antigüedad estimada FIFO'],['company','Existencias por empresa']],sales:[['sales','Venta real frente a meta']],people:[['people','Evolución del ausentismo']]};
const defaults={ops:'stages',cos:'cost',inv:'invflow',log:'logflow',sales:'sales',people:'people'};
let filters={},costSelection,costRefId=null,v,source,renderTimer,area='ops',view='stages',order='flow',material='all',recordId=null,detailPage=0,returnFocus=null;
const charts=new Set(),dialog=$('dialog');let largeChart=null;const detailCharts=new Set();
try{filters=M.cleanFilters(JSON.parse(localStorage.getItem('pcc.atlas.filters.v1')||'{}'));}catch{filters=M.cleanFilters();}
function remember(){try{localStorage.setItem('pcc.atlas.filters.v1',JSON.stringify(filters));}catch{/* El filtro sigue funcionando aunque el navegador no pueda conservarlo. */}}
function scopeText(){return [filters.company.length?filters.company.join(' + '):'Todas las empresas',filters.line.length?filters.line.join(' + '):'Todas las líneas',filters.category.length?filters.category.join(' + '):'Todas las categorías'].join(' · ');}
function date(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')?s.split('-').reverse().join('/'):s||'Fecha no disponible';}
function sourceState(status){return ({loading:'Consultando',error:'Fuente no disponible',empty:'Sin registros'})[status]||'';}
function freshness(records){return records?.length?PccFresh.summary(records).status:'Fecha de origen por confirmar';}
function status(id){
 if(id==='sales'||id==='people')return 'En construcción';
 if(id==='ops')return (v.label+' · '+(sourceState(v.ops.status)||freshness(v.ops.records)))+(v.ops.wipStatus==='error'?' · WIP no disponible':'');
 if(id==='cos')return v.cos.period.label+' · '+(sourceState(v.cos.status)||freshness(v.cos.records));
 if(id==='inv')return sourceState(v.inv.status)||'Corte '+date(v.inv.cutoff)+' · '+freshness(v.inv.records);
 return sourceState(v.log.status)||'Corte '+date(v.log.meta.corte_inventario)+' · valores SIESA';
}
function stats(id){
 if(id==='ops')return [['Cumplimiento',pct(v.ops.compliance),v.ops.performanceSupported?'Meta 100%':'Sin desglose del indicador','performance'],['Eficiencia',pct(v.ops.efficiency),v.ops.performanceSupported?'Meta 75%':'Sin desglose del indicador','performance'],['Producto en proceso',num(v.ops.wipUnits),!v.ops.wipSupported?'Categoría TEX no disponible':v.ops.wipReady?num(v.ops.lots.length)+' lotes':sourceState(v.ops.wipStatus),'wip'],['Presentación · '+(v.key?v.months.at(-1):'período'),num(v.ops.wipReady&&v.key?v.ops.stages[4].values.at(-1):null),'Unidades cumplidas','stages']];
 if(id==='cos')return [['Rentabilidad',pct(v.cos.rent),'Promedio por registro','cost'],['CCU sin IVA',pct(v.cos.ccu),'Promedio por registro','cost'],['Margen promedio',cash(v.cos.margin),'Pesos por unidad','margin'],['Costeos negativos',num(v.cos.negativeCount)+' / '+num(v.cos.count),v.cos.count>0?pct(v.cos.negativeCount===null?null:v.cos.negativeCount/v.cos.count)+' de los registros':'Registros del alcance','negative']];
 if(id==='inv'){
  const dispatchIndex=v.inv.movements.keys.indexOf(v.key);
  return [['Existencias',num(v.inv.units),'Unidades · todas las bodegas','invflow'],['Costo de inventario',money(v.inv.knownValue),v.inv.missingCostUnits>0?'Parcial · '+num(v.inv.missingCostUnits)+' unidades sin costo':v.inv.ready?'Costo conocido del alcance':'Valoración no disponible','invvalue'],['Más de 90 días',num(v.inv.age[3]),pct(v.inv.agedShare)+' del principal','invage'],['Despachadas · '+(v.key?v.months.at(-1):'período'),num(v.inv.ready&&dispatchIndex>=0?v.inv.movements.shipped[dispatchIndex]:null),dispatchIndex>=0?'Unidades · ventana de la fuente':'Mes fuera de la ventana disponible','invflow']];
 }
 if(id==='log')return [['Existencias',money(v.log.total),v.log.supported?'Telas e insumos':'Sin desglose por línea / categoría','stock'],['Saldo FIFO +90',money(v.log.aged),v.log.supported?'Antigüedad estimada':'Sin desglose por línea / categoría','logage'],['Telas',money(v.log.warehouses[0].value),'Valor de existencias','stock'],['Insumos',money(v.log.warehouses[1].value),'Valor de existencias','stock']];
 const future=id==='sales'?[['Venta / meta','Meta aprobada por integrar'],['Venta al consumidor','Valor y unidades'],['Tiendas con faltantes','Disponibilidad'],['Reposición pendiente','Solicitudes por atender']]:[['Ausentismo','Horas perdidas / programadas'],['Personal activo','Personas al corte'],['Vacantes / planta','Planta aprobada'],['Rotación','Planta media por validar']];
 return future.map(s=>[s[0],'—',s[1],id]);
}
function action(id,target,body,cls,label){return '<button type="button" class="'+cls+'" data-open="'+id+'" data-target="'+target+'" aria-label="'+esc(label)+'">'+body+'</button>';}
function statMarkup(id){return stats(id).map(s=>{const partial=id==='inv'&&s[3]==='invvalue'&&v.inv.missingCostUnits>0;return action(id,s[3],'<span>'+esc(s[0])+'</span><strong'+(s[1].startsWith('$')?' class="ax-cash"':'')+'>'+esc(s[1])+'</strong><small'+(partial?' class="atlas-essential"':'')+'><span class="atlas-note-full">'+esc(s[2])+'</span>'+(partial?'<span class="atlas-note-compact">'+num(v.inv.missingCostUnits)+' uds s/costo</span>':'')+'</small>','ax-kpi','Ampliar '+s[0]+' de '+areaNames[id]+': '+s[1]+'. '+s[2]);}).join('');}
function drawFilters(){
 const allowed=M.hierarchy.filter(h=>!filters.company.length||filters.company.includes(h.company)),groups=allowed.filter(h=>!filters.line.length||filters.line.includes(h.line));
 const opened=$('.ax-filter-menu[open]')?.dataset.menu,focused=document.activeElement?.dataset.filter?{key:document.activeElement.dataset.filter,value:document.activeElement.value}:null;
 const option=(key,value)=>'<label><input type="checkbox" data-filter="'+key+'" value="'+esc(value)+'" '+(filters[key].includes(value)?'checked':'')+'><span>'+esc(value)+'</span></label>';
 const menu=(key,label,items)=>'<details class="ax-filter-menu" data-menu="'+key+'"><summary>'+label+': <strong>'+(filters[key].length?esc(filters[key].join(', ')):'Todas')+'</strong><span aria-hidden="true">⌄</span></summary><div class="ax-filter-options"><button type="button" class="ax-filter-all" data-all="'+key+'">Seleccionar todas</button>'+items+'</div></details>';
 $('[data-filters]').innerHTML=menu('company','Empresa',['EU','TEX'].map(x=>option('company',x)).join(''))+menu('line','Línea',allowed.map(h=>option('line',h.line)).join(''))+menu('category','Categoría',groups.map(h=>'<span class="ax-filter-group">'+esc(h.line)+'</span>'+h.cats.map(x=>option('category',x)).join('')).join(''))+'<button type="button" class="ax-clear-filters" data-clear>Limpiar filtros</button>';
 if(opened)$('[data-menu="'+opened+'"]').open=true;
 if(focused){const input=[...root.querySelectorAll('[data-filter]')].find(n=>n.dataset.filter===focused.key&&n.value===focused.value);input?.focus({preventScroll:true});}
 $('[data-scope]').innerHTML='<span class="atlas-current-scope" title="'+esc(scopeText())+'">'+esc(scopeText())+'</span><span>Operaciones: '+esc(v.label)+' · Costos: '+esc(v.cos.period.label)+' · inventarios: corte de cada fuente</span>';
}
function descriptor(target,selectedMaterial='all'){
 const percent=a=>a.map(n=>finite(n)?n*100:null),series=(name,values,color,dash=false)=>({name,values,color,dash});
 if(target==='stages')return {available:v.ops.wipReady&&!!v.key,labels:v.months,unit:'Unidades',series:v.ops.stages.map((s,i)=>series(s.name,s.values,colors[i],i===3))};
 if(target==='cost')return {available:v.cos.ready,labels:v.cos.period.labels,unit:'Porcentaje',percent:true,series:[series('Rentabilidad',percent(v.cos.monthly.map(r=>r.rent)),colors[3]),series('CCU sin IVA',percent(v.cos.monthly.map(r=>r.ccu)),colors[1],true)]};
 if(target==='margin')return {available:v.cos.ready,labels:v.cos.period.labels,unit:'Pesos por unidad',series:[series('Margen promedio',v.cos.monthly.map(r=>r.margin),colors[1])]};
 if(target==='invflow')return {available:v.inv.ready&&!!v.inv.movements.keys.length,labels:v.inv.movements.labels,unit:'Unidades',bars:true,series:[series('Recibidas EOP',v.inv.movements.received,colors[1]),series('Despachadas RM',v.inv.movements.shipped,colors[0])]};
 if(target==='logflow'){
  const rows=(source.log?.moves||[]).filter(r=>(!filters.company.length||filters.company.includes(r.company))&&(selectedMaterial==='all'||r.warehouse===selectedMaterial));
  const keys=v.log.movements.keys;
  return {available:v.log.ready&&!!keys.length,labels:v.log.movements.labels,unit:'$ millones',series:[series('Entradas',keys.map(k=>rows.filter(r=>r.date.slice(0,7)===k).reduce((s,r)=>s+r.inCost,0)/1e6),colors[1]),series('Salidas',keys.map(k=>rows.filter(r=>r.date.slice(0,7)===k).reduce((s,r)=>s+r.outCost,0)/1e6),colors[0],true)]};
 }
 return null;
}
function unavailable(id,target){
 if(id==='ops'&&!v.ops.wipSupported&&target!=='performance')return 'Sin desglose de categoría TEX en esta fuente';
 if(id==='ops'&&target==='performance'&&!v.ops.performanceSupported)return 'Este indicador no dispone del desglose seleccionado';
 if(id==='log'&&!v.log.supported)return 'Sin desglose por línea o categoría de producto terminado';
 const state=id==='ops'&&target!=='performance'?v.ops.wipStatus:v[id]?.status;
 return sourceState(state)||(!v.key&&['stages','performance'].includes(target)?'Período no configurado':'Sin registros para el alcance seleccionado');
}
const empty=text=>'<div class="ax-empty-chart">'+esc(text)+'</div>';
function legendHTML(setting){const short={'Planeación':'Plan.','Confección':'Conf.','Tintorería':'Tint.','Presentación':'Pres.'};return setting.series.map(s=>'<span class="ax-key" title="'+esc(s.name)+'" style="--key:'+s.color+'">'+esc(short[s.name]||s.name)+'</span>').join('');}
function chartButton(id,target,title,height){const data=descriptor(target);return action(id,target,'<span class="ax-chart-title">'+esc(title)+'<span aria-hidden="true">↗</span></span><span class="atlas-chart" style="height:'+height+'px" data-chart="'+target+'"></span><span class="ax-compact-legend">'+legendHTML(data)+'</span>','ax-chart-button','Ampliar '+title+' de '+areaNames[id]);}
function bars(items,interactive=false){
 const max=Math.max(1,...items.map(r=>r.value));
 return '<div class="ax-full-bars">'+items.map(r=>'<div class="ax-full-bar"><span>'+(interactive?'<button type="button" class="ax-detail-link" data-state="'+esc(r.name)+'">'+esc(r.name)+' ↗</button>':esc(r.name))+'</span><div class="ax-track"><div class="ax-fill" style="width:'+Math.max(0,r.value/max*100)+'%;background:'+(r.color||colors[1])+'"></div></div><span><strong>'+esc(r.label)+'</strong><small>'+esc(r.sub||'')+'</small></span></div>').join('')+'</div>';
}
function drawChart(host,setting,large=false){
 const id=large?area:host.closest('[data-area]')?.dataset.area;
 if(!setting?.available||!setting.series.some(s=>s.values.some(finite))){host.innerHTML=empty(unavailable(id,large?view:host.dataset.chart));return;}
 if(typeof Chart==='undefined'){host.innerHTML=empty('El gráfico no está disponible. Consulta los valores al ampliar.');return;}
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',setting.series.map(s=>s.name).join(' y ')+' · '+setting.unit);host.replaceChildren(canvas);
 const chart=new Chart(canvas,{type:setting.bars?'bar':'line',data:{labels:setting.labels,datasets:setting.series.map(s=>({label:s.name,data:s.values,borderColor:s.color,backgroundColor:setting.bars?s.color:s.color+'16',borderDash:s.dash?[5,3]:[],borderWidth:large?2.5:1.8,pointRadius:s.meta?0:large?3:1.5,pointHoverRadius:5,pointStyle:s.dash?'rectRot':'circle',tension:setting.performance?0.25:0,fill:!!setting.performance&&!s.meta,spanGaps:false,maxBarThickness:large?36:18}))},options:{responsive:true,maintainAspectRatio:false,animation:false,normalized:true,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},datalabels:{display:false},tooltip:{callbacks:{label:c=>c.dataset.label+': '+(setting.percent?decimal.format(c.parsed.y)+'%':decimal.format(c.parsed.y))+' '+(setting.percent?'':setting.unit)}}},scales:{x:{grid:{display:false},ticks:{font:{size:11},color:'#526b7d',maxTicksLimit:setting.performance?8:large?12:4,maxRotation:0}},y:{beginAtZero:!setting.performance,grid:{color:'#e4edf2'},border:{display:false},ticks:{maxTicksLimit:large?5:3,font:{size:11},color:'#526b7d',callback:n=>setting.percent?decimal.format(n)+'%':Math.abs(n)>=1000?decimal.format(n/1000)+'k':decimal.format(n)},title:{display:large&&!setting.performance,text:setting.unit,color:'#526b7d',font:{size:12}}}}}});
 charts.add(chart);if(large){largeChart=chart;detailCharts.add(chart);}
}
function renderCards(){
 const captions={ops:'Etapas independientes · WIP completo al ampliar',cos:'Promedios por registro · no es margen real de ventas',inv:'*Mes parcial · EOP recibidas / RM despachadas',log:'*Mes parcial · edad FIFO estimada',sales:'Venta al consumidor · fuente por integrar',people:'Incapacidades y recobros en el detalle'};
 const links={ops:[['wip','Estados del WIP'],['performance','Eficiencia y cumplimiento']],cos:[['margin','Margen mensual'],['negative','Costeos negativos'],['ranking','10 mayores y 10 menores rentabilidades'],['variation','5 mayores variaciones del costo total']],inv:[['invage','Antigüedad'],['invvalue','Costo y cobertura']],log:[['stock','Telas e insumos'],['logage','Edad FIFO'],['company','Por empresa']],sales:[['sales','Ver alcance comercial']],people:[['people','Ver alcance de Talento Humano']]};
 $('[data-areas]').innerHTML=Object.keys(areaNames).map(id=>{
  const future=['sales','people'].includes(id);let content='';
  if(id==='ops'){
   content=chartButton(id,'stages','Unidades mensuales por etapa',100);
   const top=[...v.ops.states].sort((a,b)=>b.units-a.units).slice(0,3),max=Math.max(1,...top.map(r=>r.units));
   content+=action(id,'wip','<span class="ax-chart-title">En proceso · 3 estados<span aria-hidden="true">↗</span></span>'+(v.ops.wipReady&&top.length?'<span class="ax-wip-preview">'+top.map(r=>'<span class="ax-bar-row"><span class="ax-bar-label"><span title="'+esc(r.name)+'">'+esc(r.name)+'</span><strong>'+num(r.units)+'</strong></span><span class="ax-track"><span class="ax-fill" style="width:'+r.units/max*100+'%"></span></span></span>').join('')+'</span>':empty(unavailable('ops','wip'))),'ax-chart-button','Ampliar producto en proceso por estado');
  }else if(future)content='<div class="ax-reserved"><strong>'+esc(views[id][0][1])+'</strong><span>Fuente por integrar · indicadores propuestos</span></div>';
  else content=chartButton(id,defaults[id],{cos:'Rentabilidad y CCU sin IVA · %',inv:'Recibidas vs. despachadas · unidades',log:'Entradas vs. salidas · $ millones'}[id],168);
  return '<article class="ax-tile ax-area-card '+(future?'ax-future-tile':'')+'" data-area="'+id+'" aria-label="'+areaNames[id]+'">'+action(id,defaults[id],'<span><h3>'+areaNames[id]+'</h3><span class="ax-sub">'+esc(status(id))+'</span></span><span class="ax-expand" aria-hidden="true">↗</span>','ax-area-heading','Ampliar '+areaNames[id])+'<div class="ax-visible-kpis">'+statMarkup(id)+'</div><div class="ax-area-charts">'+content+'</div><span class="ax-card-caption">'+esc(captions[id])+'</span>'+(id==='cos'?costInsights():'')+'<div class="ax-tile-foot">'+links[id].map(s=>action(id,s[0],esc(s[1])+' ↗','ax-detail-link','Ampliar '+s[1])).join('')+'</div></article>';
 }).join('');
 root.querySelectorAll('[data-chart]').forEach(host=>drawChart(host,descriptor(host.dataset.chart)));
}
function destroyCharts(largeOnly=false){for(const chart of [...charts])if(!largeOnly||detailCharts.has(chart)){chart.destroy();charts.delete(chart);}detailCharts.clear();largeChart=null;}
function note(target){
 const invRange=v.inv.movements.from&&v.inv.movements.to?date(v.inv.movements.from)+' a '+date(v.inv.movements.to):'Ventana de movimientos no verificada';
 return {stages:'Unidades según la fecha de cumplimiento de cada etapa. Una prenda puede participar en varias etapas: no se suman como producción total.',wip:'Estado actual de cada lote. El volumen muestra dónde revisar; no demuestra por sí solo un cuello de botella. Clic en un estado para consultar sus lotes.',lots:'Lotes activos del alcance seleccionado; excluye entregados y cancelados.',performance:'Mismas fórmulas del área: eficiencia ponderada por tiempos, excluye Servicios; cumplimiento = producción / meta. Las fuentes no disponibles se excluyen del cálculo.',ranking:'Referencias ordenadas por rentabilidad promedio por registro. La cifra en $ suma la utilidad de costeo (UTILIDAD EU × cantidad). Las dos listas pueden coincidir cuando hay menos de 20 referencias; no se suman porcentajes ni representan utilidad real de ventas.',variation:'Costo total por unidad, incluidos todos sus componentes. Promedio aritmético de lotes recientes (mes de referencia y anterior) frente a los seis meses previos. Mismas reglas de lotes válidos de Alertas: cantidad positiva y exclusión de ajustes sin tela. Orden por magnitud del cambio; el signo distingue subidas y bajadas. El histórico conserva contexto fuera del año seleccionado.',cost:'Promedios aritméticos por registro válido. No equivalen al margen real de ventas ni a la utilidad empresarial.',margin:'Promedio aritmético del margen en pesos por unidad por registro válido de cada mes.',negative:v.cos.period.label+' · '+num(v.cos.negativeCount)+' registros negativos de '+num(v.cos.count)+' registros del alcance. Se conservan los lotes distintos de una misma referencia.',invflow:invRange+'. Recepciones EOP y despachos RM; devoluciones, compras y ajustes son conceptos separados. *Meses parciales según la ventana de la fuente.',invage:'Inventario principal: '+num(v.inv.principal)+' unidades. Mayores a 90 días: '+num(v.inv.age[3])+' ('+pct(v.inv.agedShare)+'). Todas las bodegas: '+num(v.inv.units)+' unidades.',invvalue:'Costo conocido al corte '+date(v.inv.cutoff)+'. '+num(v.inv.missingCostUnits)+' unidades sin costo en el alcance.',logflow:'Movimientos SIESA: '+date(v.log.meta.movimientos_desde)+' a '+date(v.log.meta.movimientos_hasta)+'. *Meses parciales. El selector de materiales afecta este gráfico.',stock:'Existencias de telas e insumos al '+date(v.log.meta.corte_inventario)+'. Se presenta valor; no se suman cantidades de unidades físicas diferentes.',logage:'Estimación FIFO al '+date(v.log.meta.corte_inventario)+'. Edad indeterminada separada del saldo mayor a 90 días; no equivale a obsolescencia contable.',company:'Existencias de materiales por empresa, al corte de Logística.',sales:'Venta al consumidor, ambas empresas, líneas y tiendas. Fuente comercial pendiente de integrar.',people:'Personal al corte, ausentismo, vacantes y rotación. Cierres y reglas pendientes de validar; incapacidades y recobros en el detalle.'}[target]||'';
}
function table(headers,rows,renderRow){
 if(!rows.length)return empty('Sin registros para el alcance seleccionado');
 detailPage=Math.max(0,Math.min(detailPage,Math.ceil(rows.length/50)-1));const start=detailPage*50,shown=rows.slice(start,start+50);
 return '<div class="ax-record-scroll"><table class="ax-record-table"><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+shown.map(renderRow).join('')+'</tbody></table></div><div class="atlas-pagination"><span>'+num(start+1)+'–'+num(start+shown.length)+' de '+num(rows.length)+' registros</span><button type="button" data-page="-1" '+(!detailPage?'disabled':'')+'>Anterior</button><button type="button" data-page="1" '+(start+50>=rows.length?'disabled':'')+'>Siguiente</button></div>';
}
function seriesButtons(config){return config.series.map((s,i)=>'<button type="button" class="ax-series-button" style="--key:'+s.color+'" data-series="'+i+'" aria-pressed="true">'+esc(s.name)+'</button>').join('');}
function costInsights(){
 const r=v.cos.rankings,variation=v.cos.variation;
 return '<div class="atlas-cost-insights">'+action('cos','ranking','<span>10 mayor rentabilidad</span><strong>'+money(v.cos.ready?r.top.profit:null)+'</strong>','atlas-cost-insight','Ver referencias con mayor rentabilidad y su utilidad acumulada')+action('cos','ranking','<span>10 menor rentabilidad</span><strong>'+money(v.cos.ready?r.bottom.profit:null)+'</strong>','atlas-cost-insight','Ver referencias con menor rentabilidad y su utilidad acumulada')+action('cos','variation','<span>Δ costo total · top 5</span><strong>'+num(v.cos.ready?variation.rows.length:null)+' <small>referencias</small></strong>','atlas-cost-insight','Ver las cinco referencias con mayor variación del costo total')+'</div>';
}
function drawCostPeriod(){
 const host=$('[data-cost-period]');host.hidden=area!=='cos';if(host.hidden)return;
 const p=v.cos.period,opened=host.querySelector('.ax-filter-menu[open]')?.dataset.costMenu;
 const focused=document.activeElement?.dataset.costFilter?{key:document.activeElement.dataset.costFilter,value:document.activeElement.value}:null;
 const menu=(key,title,label,values)=>'<details class="ax-filter-menu" data-cost-menu="'+key+'"><summary>'+title+': <strong>'+esc(label)+'</strong><span aria-hidden="true">⌄</span></summary><div class="ax-filter-options"><button type="button" class="ax-filter-all" data-cost-all="'+key+'">'+(key==='years'?'Todos los años':'Todos los meses')+'</button>'+values.map(value=>'<label><input type="checkbox" data-cost-filter="'+key+'" value="'+value+'" '+(p[key].includes(value)?'checked':'')+'><span>'+esc(key==='years'?value:PccCostModel.monthLabel(value))+'</span></label>').join('')+'</div></details>';
 host.innerHTML=menu('years','Año',p.years.length?p.years.join(', '):'Todos',p.yearsAvailable)+menu('periods','Meses',p.periods.length===1?PccCostModel.monthLabel(p.periods[0]):p.periods.length?p.periods.length+' seleccionados':'Todos',p.periodsAvailable)+'<button type="button" class="ax-detail-link" data-cost-all="reset">Año en curso</button><button type="button" class="atlas-cost-compare" data-cost-compare '+(!v.cos.ready||!v.cos.count?'disabled':'')+'>Ver mismo alcance en Costos ↗</button>';
 if(opened)host.querySelector('[data-cost-menu="'+opened+'"]').open=true;
 if(focused)[...host.querySelectorAll('[data-cost-filter]')].find(n=>n.dataset.costFilter===focused.key&&n.value===focused.value)?.focus({preventScroll:true});
}
function costReferenceButton(r){return '<button type="button" class="ax-ref-link" data-cost-ref="'+esc(r.id)+'" title="'+esc(r.desc+' · '+r.company+' / '+r.line)+'">'+esc(r.ref)+' ↗</button>';}
function drawCostRanking(host){
 if(!v.cos.ready){host.innerHTML=empty(unavailable('cos','ranking'));return;}
 host.innerHTML='<div class="atlas-ranking-grid">'+[['top','Mayor rentabilidad'],['bottom','Menor rentabilidad']].map(([key,title])=>{
  const block=v.cos.rankings[key];
  return '<section class="atlas-ranking-panel"><div class="atlas-ranking-heading"><h3>'+title+'</h3><span>'+num(block.rows.length)+' referencias</span></div><strong class="atlas-ranking-total">'+cash(block.profit)+'</strong><p class="ax-sub">'+(block.missingProfit?'Subtotal conocido · '+num(block.missingProfit)+' registros sin utilidad':'Utilidad de costeo acumulada')+'</p>'+(block.rows.length?'<div class="ax-record-scroll"><table class="atlas-cost-table"><thead><tr><th scope="col">Referencia</th><th scope="col">Rentabilidad</th><th scope="col">Utilidad $</th></tr></thead><tbody>'+block.rows.map(r=>'<tr><th scope="row">'+costReferenceButton(r)+'</th><td>'+pct(r.rent)+'</td><td>'+cash(r.utilPesos)+'</td></tr>').join('')+'</tbody></table></div>':empty('Sin referencias con rentabilidad válida.'))+'</section>';
 }).join('')+'</div>';
}
const windowText=keys=>keys.map(PccCostModel.monthLabel).join(' · ');
function drawCostVariation(host){
 if(!v.cos.ready){host.innerHTML=empty(unavailable('cos','variation'));return;}
 const data=v.cos.variation;
 host.innerHTML='<div class="atlas-variation-scope"><p><strong>Reciente:</strong> '+esc(windowText(data.recent))+'</p><p><strong>Histórico:</strong> '+esc(PccCostModel.monthLabel(data.historical[0])+' — '+PccCostModel.monthLabel(data.historical.at(-1)))+'</p></div>'+(data.rows.length?'<div class="ax-record-scroll"><table class="atlas-cost-table atlas-variation-table"><thead><tr>'+['Referencia / línea','Costo histórico / ud.','Costo reciente / ud.','Δ $ / ud.','Δ %'].map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+data.rows.map(r=>'<tr><th scope="row">'+costReferenceButton(r)+'<small>'+esc(r.company+' / '+r.line)+'</small></th><td>'+exact(r.before)+'</td><td>'+exact(r.after)+'</td><td>'+exact(r.change)+'</td><td class="'+(r.delta>0?'ax-negative-value':'atlas-cost-decrease')+'">'+(r.delta>0?'+':'')+pct(r.delta)+'</td></tr>').join('')+'</tbody></table></div>':empty('No hay variaciones con lotes válidos en ambas ventanas para este alcance.'));
}
function drawCostReference(host){
 const r=(view==='variation'?v.cos.variation.rows:v.cos.references).find(r=>r.id===costRefId);
 if(!r){costRefId=null;host.innerHTML=empty('La referencia ya no pertenece al alcance seleccionado.');return;}
 const rows=view==='variation'?[...r.historicalRows,...r.recentRows]:r.rows;
 $('#atlas-dialog-title').textContent='Referencia '+r.ref+' · '+r.company+' / '+r.line;
 host.innerHTML='<button type="button" class="ax-detail-link" data-cost-back>← Volver al resumen de referencias</button><div class="ax-record-summary"><strong>'+esc(r.desc)+'</strong><span>'+num(rows.length)+' registros · '+(view==='variation'?'Lotes de las dos ventanas de comparación':esc(v.cos.period.label))+'</span></div>'+table(['Período','Lote','Unidades','Costo total / ud.','Rentabilidad','Utilidad $'],[...rows].sort((a,b)=>a.fecha.localeCompare(b.fecha)),r=>'<tr><th scope="row">'+esc(PccCostModel.monthLabel(r.fecha))+'</th><td>'+esc(r.lote??'—')+'</td><td>'+num(r.cant)+'</td><td>'+exact(r.ct)+'</td><td>'+pct(r.rent)+'</td><td>'+cash(r.utilPesos)+'</td></tr>');
}
function stageTable(config){
 const total=values=>values.some(finite)?values.reduce((sum,n)=>sum+(finite(n)?n:0),0):null;
 return '<div class="atlas-stage-data"><table class="atlas-stage-table"><caption>Unidades por etapa · '+esc(v.label)+'</caption><thead><tr><th scope="col">Etapa</th>'+config.labels.map(label=>'<th scope="col">'+esc(label)+'</th>').join('')+'<th scope="col">Total etapa</th></tr></thead><tbody>'+config.series.map((s,i)=>'<tr data-stage-row="'+i+'"><th scope="row"><span class="ax-key" style="--key:'+s.color+'">'+esc(s.name)+'</span></th>'+s.values.map(n=>'<td>'+num(n)+'</td>').join('')+'<td><strong>'+num(total(s.values))+'</strong></td></tr>').join('')+'</tbody></table></div>';
}
function drawPerformance(host){
 const panels=[['efficiency','Eficiencia',v.ops.efficiency,'#1b3a5c'],['compliance','Cumplimiento',v.ops.compliance,'#0d8b7c']];
 host.innerHTML='<div class="atlas-performance-grid">'+panels.map(([id,title,value,color])=>{
  const data=v.ops.performance[id];
  return '<section class="atlas-performance-panel" aria-labelledby="atlas-'+id+'"><div class="atlas-performance-heading"><h3 id="atlas-'+id+'">'+title+'</h3><strong>'+pct(value)+'</strong></div><p class="atlas-performance-sub">Tendencia diaria · '+esc(v.label)+'</p><div class="atlas-performance-legend"><span class="ax-key" style="--key:'+color+'">'+title+'</span><span class="atlas-target-key">Meta '+pct(data.meta)+'</span></div><div class="atlas-performance-chart" data-performance-chart="'+id+'"></div><h4>Por proceso <span>· barra relativa a la meta</span></h4><div class="atlas-process-list">'+(data.processes.length?data.processes.map(p=>{
   const status=p.value>=data.meta?'met':p.value>=data.meta*.85?'near':'low';
   return '<div class="atlas-process-row" data-process="'+esc(p.id)+'" title="'+esc(p.name+': '+pct(p.value)+', meta '+pct(data.meta))+'"><span>'+esc(p.name)+'</span><span class="ax-track"><span class="ax-fill atlas-result-'+status+'" style="width:'+Math.min(100,Math.max(0,p.value/data.meta*100))+'%"></span></span><strong class="atlas-result-text-'+status+'">'+pct(p.value)+'</strong></div>';
  }).join(''):'<p class="ax-sub">Sin denominador válido para mostrar procesos.</p>')+'</div></section>';
 }).join('')+'</div>';
 for(const [id,title,,color]of panels){
  const data=v.ops.performance[id],values=data.values.map(n=>finite(n)?n*100:null);
  drawChart(host.querySelector('[data-performance-chart="'+id+'"]'),{available:values.some(finite),performance:true,percent:true,unit:'Porcentaje',labels:v.ops.performance.days.map(d=>'Día '+d),series:[{name:title,values,color},{name:'Meta '+pct(data.meta),values:values.map(()=>data.meta*100),color:'#cc8585',dash:true,meta:true}]},true);
 }
}
function negatives(){
 const rows=[...v.cos.negative].sort((a,b)=>a.rent-b.rent);
 return '<div class="ax-record-summary"><strong>'+num(v.cos.negativeCount)+' registros negativos</strong><span>'+num(new Set(rows.map(r=>r.ref)).size)+' referencias · '+esc(v.cos.period.label)+'</span></div>'+table(['Empresa / línea','Referencia / descripción','Lote','Unidades','Precio venta / ud.','Costo / ud.','Rentabilidad','Margen / ud.'],rows,r=>'<tr><td>'+esc(r.company)+'<small>'+esc(r.line)+'</small></td><td><button type="button" class="ax-ref-link" data-record="'+r.id+'">'+esc(r.ref)+' ↗</button><small>'+esc(r.desc)+'</small></td><td>'+esc(r.lote??'—')+'</td><td>'+num(r.cant)+'</td><td>'+exact(r.pv)+'</td><td>'+exact(r.ct)+'</td><td class="ax-negative-value">'+pct(r.rent)+'</td><td class="ax-negative-value">'+exact(r.margen)+'</td></tr>');
}
function drawAgeDonut(host){
 const parts=[{name:'Hasta 90 días',value:v.log.ageRows.reduce((s,r)=>s+r.values.slice(0,3).reduce((a,b)=>a+b,0),0),color:colors[1]},{name:'Más de 90 días',value:v.log.aged,color:colors[2]},{name:'Edad indeterminada',value:v.log.unknown,color:'#8ba2b3'}];
 const total=parts.reduce((s,r)=>s+r.value,0);
 if(!total||typeof Chart==='undefined'){host.innerHTML=bars(parts.map(r=>({...r,label:money(r.value),sub:'Valor FIFO'})));return;}
 host.innerHTML='<div class="atlas-age-donut"><canvas role="img" aria-label="'+esc('Edad estimada FIFO: '+pct(v.log.aged/total)+' del valor tiene más de 90 días')+'"></canvas></div>';
 const chart=new Chart(host.querySelector('canvas'),{type:'doughnut',data:{labels:parts.map(p=>p.name),datasets:[{data:parts.map(p=>p.value),backgroundColor:parts.map(p=>p.color),borderWidth:0,spacing:3}]},options:{responsive:true,maintainAspectRatio:false,cutout:'75%',animation:false,plugins:{legend:{display:false},datalabels:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+money(c.parsed)}}}},plugins:[{id:'atlas-age-label',afterDraw(chart){const {ctx,chartArea}=chart;if(!chartArea)return;const x=(chartArea.left+chartArea.right)/2,y=(chartArea.top+chartArea.bottom)/2;ctx.save();ctx.textAlign='center';ctx.fillStyle='#20394d';ctx.font='500 28px Bahnschrift, sans-serif';ctx.fillText(pct(v.log.aged/total),x,y);ctx.fillStyle='#526b7d';ctx.font='12px sans-serif';ctx.fillText('+90 días · FIFO',x,y+23);ctx.restore();}}]});
 charts.add(chart);detailCharts.add(chart);largeChart=chart;
 $('[data-large-legend]').innerHTML=parts.map(p=>'<span class="ax-key" style="--key:'+p.color+'">'+esc(p.name)+': '+money(p.value)+'</span>').join('');
}
function sourceDetails(){
 let html='';for(const [id,s]of [['ops',v.ops],['cos',v.cos],['inv',v.inv]]){
  html+='<section class="atlas-source-block"><h3>'+areaNames[id]+'</h3><p>'+esc(status(id))+'</p><ul>';
  for(const r of s.records)html+='<li><strong>'+esc(r.label||r.sheet||'Fuente')+'</strong> · '+esc(PccFresh.displayState(r))+' · '+esc(PccFresh.referenceLabel(r))+(r.business?' · '+esc(r.business):'')+'</li>';
  html+='</ul></section>';
 }
 return html+'<section class="atlas-source-block"><h3>WIP y etapas</h3><p>'+esc(sourceState(v.ops.wipStatus)||'Lotes EU y TEX conectados · estado actual y fechas de cumplimiento')+'</p></section><section class="atlas-source-block"><h3>Logística</h3><p>'+esc(status('log'))+'</p><p>Movimientos: '+esc(date(v.log.meta.movimientos_desde))+' a '+esc(date(v.log.meta.movimientos_hasta))+'</p><p>'+esc(v.log.error||v.log.ageMessage||'Edad FIFO del mismo corte validada por el área')+'</p></section><section class="atlas-source-block"><h3>Ventas y Talento Humano</h3><p>En construcción · sin cifras simuladas</p></section>';
}
function drawDetail(){
 if(!dialog.open)return;destroyCharts(true);const host=$('[data-enlarged]');$('[data-large-legend]').replaceChildren();
 dialog.dataset.detailArea=area;dialog.dataset.detailView=view;
 $('[data-modal-area]').textContent=area==='sources'?'PCC · Gerencia General':areaNames[area]+' · vista ampliada';
 $('#atlas-dialog-title').textContent=area==='sources'?'Fechas y fuentes':(view==='lots'?'Lotes · '+stateFilter:views[area].find(s=>s[0]===view)[1]);
 $('[data-modal-scope]').textContent=scopeText()+(area==='cos'&&v.cos.rows.length?' · Líneas incluidas: '+[...new Set(v.cos.rows.map(r=>r.line))].join(', '):'');
 drawCostPeriod();
 $('[data-modal-kpis]').hidden=area==='sources'||view==='negative'||view==='performance'||view==='stages'||(area==='cos'&&(['ranking','variation'].includes(view)||costRefId!==null));
 $('[data-modal-kpis]').innerHTML=area==='sources'?'':stats(area).map(s=>'<div><span>'+esc(s[0])+'</span><strong>'+esc(s[1])+'</strong><small>'+esc(s[2])+'</small></div>').join('');
 $('.ax-modal-controls').hidden=area==='sources';
 $('[data-view]').innerHTML=area==='sources'?'':views[area].map(s=>'<option value="'+s[0]+'">'+esc(s[1])+'</option>').join('');$('[data-view]').value=view==='lots'?'wip':view;
 $('[data-order-label]').hidden=view!=='wip';$('[data-material-label]').hidden=view!=='logflow';
 $('[data-order]').value=order;$('[data-material]').value=material;
 $('[data-note]').textContent=area==='sources'?'Cada fuente conserva su fecha y alcance. Las fallas y los datos parciales permanecen identificados.':note(view);
 if(area==='sources'){host.innerHTML=sourceDetails();return;}
 if(area==='cos'&&costRefId!==null){drawCostReference(host);return;}
 if(recordId!==null){
  const row=v.cos.negative.find(r=>r.id===recordId);
  if(!row){recordId=null;}else{
   $('#atlas-dialog-title').textContent='Referencia '+row.ref+' · lote '+(row.lote??'—');
   host.innerHTML='<button type="button" class="ax-detail-link" data-back>← Volver a los registros negativos</button><div class="ax-record-summary"><strong>'+esc(row.desc)+'</strong><span>'+esc(row.company+' · '+row.line+' · '+row.sourceCategory+' · '+v.cos.period.label)+'</span></div><dl class="ax-record-detail">'+[['Referencia',row.ref],['Lote',row.lote??'—'],['Unidades',num(row.cant)],['Precio de venta / unidad',exact(row.pv)],['Costo / unidad',exact(row.ct)],['Margen / unidad',exact(row.margen)],['Rentabilidad',pct(row.rent)],['CCU sin IVA',pct(row.ccu)]].map(([k,val])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(val)+'</dd></div>').join('')+'</dl>';return;
  }
 }
 const config=descriptor(view,material);
 if(config&&view==='stages'){
  host.innerHTML='<div class="atlas-large-chart"></div><div class="atlas-stage-legend"></div>'+stageTable(config);
  drawChart(host.firstElementChild,config,true);
  if(largeChart)host.querySelector('.atlas-stage-legend').innerHTML=seriesButtons(config);
  return;
 }
 if(config){host.innerHTML='<div class="atlas-large-chart"></div>';drawChart(host.firstElementChild,config,true);if(largeChart){$('[data-large-legend]').innerHTML=config.series.map((s,i)=>'<button type="button" class="ax-series-button" style="--key:'+s.color+'" data-series="'+i+'" aria-pressed="true">'+esc(s.name)+'</button>').join('');host.insertAdjacentHTML('beforeend','<details class="atlas-chart-data"><summary>Ver datos del gráfico</summary>'+table(['Período',...config.series.map(s=>s.name)],config.labels.map((label,i)=>({label,index:i})),r=>'<tr><th scope="row">'+esc(r.label)+'</th>'+config.series.map(s=>'<td>'+esc(config.percent?finite(s.values[r.index])?decimal.format(s.values[r.index])+'%':'—':num(s.values[r.index]))+'</td>').join('')+'</tr>')+'</details>');}return;}
 if(view==='ranking'){drawCostRanking(host);return;}
 if(view==='variation'){drawCostVariation(host);return;}
 if(view==='negative'){host.innerHTML=v.cos.ready?negatives():empty(unavailable('cos',view));return;}
 if(['wip','lots'].includes(view)&&!v.ops.wipReady||view==='performance'&&(!v.ops.ready||!v.ops.performanceSupported)){host.innerHTML=empty(unavailable('ops',view));return;}
 if(['invage','invvalue'].includes(view)&&!v.inv.ready){host.innerHTML=empty(unavailable('inv',view));return;}
 if(['stock','logage','company'].includes(view)&&(!v.log.ready||view==='logage'&&!v.log.ageReady)){host.innerHTML=empty(v.log.ageMessage||unavailable('log',view));return;}
 if(view==='wip'){
  const rows=order==='volume'?[...v.ops.states].sort((a,b)=>b.units-a.units):v.ops.states;
  host.innerHTML=rows.length?bars(rows.map(r=>({name:r.name,value:r.units,label:num(r.units),sub:num(r.lots)+' lotes',color:r.name==='NO CONFORME'?'#cc9748':colors[1]})),true):empty('Sin lotes en el alcance seleccionado');
 }else if(view==='lots'){
  const rows=stateFilter?v.ops.lots.filter(r=>r.estado===stateFilter):v.ops.lots;
  host.innerHTML='<button type="button" class="ax-detail-link" data-wip-back>← Volver a los estados</button><div class="ax-record-summary"><strong>'+esc(stateFilter)+'</strong><span>'+num(rows.length)+' lotes · '+num(rows.reduce((s,r)=>s+r.cant,0))+' unidades</span></div>'+table(['Empresa / línea','Orden de corte','Referencia','Producto','Estado','Unidades'],rows,r=>'<tr><td>'+esc(r.company+' / '+r.line)+'</td><td>'+esc(r.ordenCorte)+'</td><td>'+esc(r.refSap)+'</td><td>'+esc(r.producto)+'</td><td>'+esc(r.estado)+'</td><td>'+num(r.cant)+'</td></tr>');
 }else if(view==='performance')drawPerformance(host);
 else if(view==='invage')host.innerHTML=bars(v.inv.age.map((val,i)=>({name:['0–30 días','31–60 días','61–90 días','Más de 90 días'][i],value:val,label:num(val),sub:'unidades',color:[colors[1],colors[4],colors[0],colors[2]][i]})));
 else if(view==='invvalue')host.innerHTML='<div class="ax-value-detail"><span>Costo conocido del inventario PT</span><strong>'+exact(v.inv.knownValue)+'</strong><p>'+num(v.inv.units)+' unidades en todas las bodegas · '+num(v.inv.missingCostUnits)+' unidades sin costo.</p><p>'+(v.inv.missingCostUnits?'Valoración parcial: faltan costos para completar el total.':'Todas las unidades del alcance tienen costo conocido.')+'</p></div>';
 else if(view==='stock')host.innerHTML=bars(v.log.warehouses.map((r,i)=>({name:r.name,value:r.value,label:money(r.value),sub:'Valor SIESA',color:colors[i?0:1]})));
 else if(view==='logage')drawAgeDonut(host);
 else if(view==='company')host.innerHTML=bars(v.log.byCompany.map(r=>({name:r.company,value:r.value,label:money(r.value),sub:'Telas + insumos'})));
 else host.innerHTML='<div class="ax-large-pending"><strong>En construcción</strong><p>'+esc(note(view))+'</p><span class="ax-sub">Sin cifras simuladas</span></div>';
}
let stateFilter='';
function open(id,target,trigger){
 area=id;view=target;recordId=null;costRefId=null;detailPage=0;stateFilter='';returnFocus=trigger||document.activeElement;
 if(!dialog.open)dialog.showModal();document.body.classList.add('atlas-modal-open');drawDetail();
}
function render(){
 renderTimer=null;source=PccExecutiveSource();v=M.build(source,filters,{period:PccExecutiveModel.period,ops:PccData.ops},costSelection);filters=v.filters;costSelection={years:v.cos.period.years,periods:v.cos.period.periods};
 fitBoard();destroyCharts();drawFilters();renderCards();$('[data-period]').textContent='Operaciones: '+v.label+' · Costos: '+v.cos.period.label;
 if(document.body.dataset.gerencia==='gg')document.getElementById('liveLbl').textContent=[v.ops,v.cos,v.inv,v.log].filter(s=>s.status==='ready').length+' áreas conectadas';
 if(dialog.open)drawDetail();
}
function refresh(){if(!renderTimer)renderTimer=setTimeout(render,40);}
function fitBoard(){if(!page.hidden)root.style.setProperty('--atlas-top',Math.max(0,page.getBoundingClientRect().top+window.scrollY)+'px');}
function changeFilters(){filters=M.cleanFilters(filters);recordId=null;costRefId=null;detailPage=0;remember();render();}
root.addEventListener('click',event=>{
 const close=event.target.closest('[data-close]');if(close){dialog.close();return;}
 if(event.target.closest('[data-cost-compare]')){const context=v.cos.nativeFilters;dialog.close();PccExecutiveOpen('cos',context);return;}
 const costAll=event.target.closest('[data-cost-all]');if(costAll){if(costAll.dataset.costAll==='reset')costSelection=undefined;else costSelection[costAll.dataset.costAll]=[];costRefId=null;recordId=null;detailPage=0;render();return;}
 const costRef=event.target.closest('[data-cost-ref]');if(costRef){costRefId=costRef.dataset.costRef;detailPage=0;drawDetail();return;}
 if(event.target.closest('[data-cost-back]')){costRefId=null;detailPage=0;drawDetail();return;}
 if(event.target.closest('[data-wip-back]')){view='wip';stateFilter='';detailPage=0;drawDetail();return;}
 const sourceButton=event.target.closest('[data-sources]');if(sourceButton){open('sources','sources',sourceButton);return;}
 const clear=event.target.closest('[data-clear]'),all=event.target.closest('[data-all]');if(clear||all){if(clear)filters=M.cleanFilters();else filters[all.dataset.all]=[];changeFilters();return;}
 const record=event.target.closest('[data-record]');if(record){recordId=record.dataset.record;drawDetail();return;}
 if(event.target.closest('[data-back]')){recordId=null;drawDetail();return;}
 const state=event.target.closest('[data-state]');if(state){stateFilter=state.dataset.state;view='lots';detailPage=0;drawDetail();return;}
 const paging=event.target.closest('[data-page]');if(paging){detailPage+=Number(paging.dataset.page);drawDetail();return;}
 const series=event.target.closest('[data-series]');if(series&&largeChart){const i=Number(series.dataset.series),visible=largeChart.isDatasetVisible(i);if(visible&&largeChart.data.datasets.filter((_,j)=>largeChart.isDatasetVisible(j)).length===1)return;largeChart.setDatasetVisibility(i,!visible);largeChart.update('none');series.setAttribute('aria-pressed',String(!visible));$('[data-stage-row="'+i+'"]')?.classList.toggle('atlas-series-muted',visible);return;}
 const target=event.target.closest('[data-open]');if(target){open(target.dataset.open,target.dataset.target,target);return;}
 const summary=event.target.closest('.ax-filter-menu summary');if(summary)root.querySelectorAll('.ax-filter-menu[open]').forEach(el=>{if(el!==summary.parentElement)el.open=false;});
 if(!event.target.closest('.ax-filter-menu'))root.querySelectorAll('.ax-filter-menu[open]').forEach(el=>el.open=false);
});
root.addEventListener('change',event=>{
 const input=event.target;
 if(input.dataset.filter){const key=input.dataset.filter;filters[key]=input.checked?[...filters[key],input.value]:filters[key].filter(x=>x!==input.value);changeFilters();}
 else if(input.dataset.costFilter){const key=input.dataset.costFilter;costSelection[key]=input.checked?[...costSelection[key],input.value]:costSelection[key].filter(x=>x!==input.value);costRefId=null;recordId=null;detailPage=0;render();}
 else if(input.matches('[data-view]')){view=input.value;recordId=null;costRefId=null;stateFilter='';detailPage=0;drawDetail();}
 else if(input.matches('[data-order]')){order=input.value;drawDetail();}
 else if(input.matches('[data-material]')){material=input.value;drawDetail();}
});
dialog.addEventListener('close',()=>{destroyCharts(true);document.body.classList.remove('atlas-modal-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
document.addEventListener('click',event=>{if(!root.contains(event.target))root.querySelectorAll('.ax-filter-menu[open]').forEach(el=>el.open=false);});
window.addEventListener('hashchange',()=>{if(location.hash!=='#gg'&&dialog.open)dialog.close();requestAnimationFrame(()=>{for(const chart of charts)chart.resize();});});
window.addEventListener('resize',fitBoard);
document.fonts?.ready.then(fitBoard);
window.PccAtlas={refresh,snapshot:()=>v};render();
})();
