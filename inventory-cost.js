(()=> {
 'use strict';
 const model=PccInventoryCostModel;
 const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const finite=Number.isFinite;
 const number=new Intl.NumberFormat('es-CO',{maximumFractionDigits:3});
 const exact=new Intl.NumberFormat('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2});
 const percent=new Intl.NumberFormat('es-CO',{style:'percent',maximumFractionDigits:1});
 const monthLabel=new Intl.DateTimeFormat('es-CO',{month:'short',year:'numeric',timeZone:'UTC'});
 const dateLabel=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bogota'});
 const money=n=>finite(n)?'$ '+exact.format(n):'—';
 const num=n=>finite(n)?number.format(n):'—';
 const share=(part,total)=>finite(part)&&total>0?percent.format(part/total):'—';
 const date=s=>s?s.split('-').reverse().join('/'):'—';
 const status=s=>({loading:'Consultando',ready:'Disponible',error:'Fuente no disponible',empty:'Sin registros'})[s]||s;
 const sources={wip:'WIP',pt:'Inventario PT',log:'Logística'};
 const pages={current:'Resumen',sections:'Participación por sección',aging:'Más de 90 días',wip:'WIP por estado',history:'Histórico mensual'};
 function comparison(rows,compact=false){
  const areas=model.byArea(rows);
  const max=Math.max(0,...areas.flatMap(({value,agedValue})=>[value,agedValue]).filter(finite));
  const series=(value,total,label,alert)=>'<div class="ic-bar-series'+(alert?' ic-bar-alert':'')+'">'+
   '<div class="ic-bar-shape" style="--ic-bar-size:'+(max>0&&finite(value)?Math.max(0,value)/max*100:0)+'%">'+
   '<span class="ic-bar-amount"><span class="ic-sr-only">'+label+' </span>'+money(value)+
   (compact&&finite(value)&&total>0?'<small class="ic-bar-share">'+share(value,total)+(alert?' del área':' del total')+'</small>':'')+'</span>'+
   (finite(value)&&value>0?'<i aria-hidden="true"></i>':'')+'</div></div>';
  const total=areas.reduce((sum,row)=>sum+(row.value??0),0);
  const groups=areas.map(row=>{
   const caption=row.cutoffs.length?'Corte '+row.cutoffs.map(date).join(' · '):row.area==='Ventas'?'Fuente por integrar':'Corte sin confirmar';
   return '<div class="ic-bar-group" role="group" aria-label="'+html(row.area)+'">'+
    '<div class="ic-bar-pair">'+series(row.value,total,'Costo total',false)+series(row.agedValue,row.value,'Costo de más de 90 días',true)+'</div>'+
    '<div class="ic-bar-caption"><strong>'+html(row.area)+'</strong><small>'+html(caption)+'</small></div></div>';
  }).join('');
  return '<figure class="ic-comparison'+(compact?' ic-comparison-compact':'')+'"><div class="ic-chart-key"><span>Costo total</span><span>Más de 90 días</span></div>'+
   '<div class="ic-bar-groups">'+groups+'</div><figcaption>El saldo de más de 90 días está incluido en el costo total. — Valoración no disponible.</figcaption></figure>';
 }
 function createReport(root,embedded=false){
 const $=selector=>root.querySelector(selector);
 const dialog=embedded?root.closest('dialog'):null;
 const visible=()=>!root.hidden&&(!embedded||dialog.open);
 let company='',sectionArea='',agingArea='',view='current',exactClose=false,current,chart;
 const history={pt:{},log:{}};
 const historyRequests=new Map();
 const panelId=embedded?'ic-modal-report':'ic-report';
 root.innerHTML=(embedded?'':'<header class="ic-header"><div><h1 tabindex="-1">Costo inventarios</h1><p>Valoración consolidada en pesos colombianos</p></div>'+
  '<label class="ic-filter">Empresa <select data-ic-company><option value="">Todas</option><option value="EU">EU</option><option value="TEX">TEX</option></select></label></header>')+
  '<nav class="ic-nav" aria-label="Informes de costo de inventarios">'+Object.entries(pages).map(([id,label])=>
   '<button type="button" data-ic-view="'+id+'" aria-pressed="'+(id===view)+'" aria-controls="'+panelId+'">'+label+'</button>').join('')+'</nav>'+
  '<section id="'+panelId+'" data-ic-body aria-label="Vista de costo de inventarios"></section>';

 const kpi=(name,value,detail,alert=false)=>'<div class="ic-kpi'+(alert?' ic-alert':'')+'"><span>'+name+'</span><strong>'+value+
  '</strong><small>'+detail+'</small></div>';
 const table=(head,rows)=>'<div class="ic-scroll" tabindex="0" role="region" aria-label="Datos de inventario"><table><thead><tr>'+
  head.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 const quantities=row=>row.agedQuantities?.length?row.agedQuantities.map(([unit,qty])=>num(qty)+' '+html(unit)).join('<br>'):num(row.agedUnits);
 function sections(aging,area){
  const total=aging?current.inventory.agedTotal:current.inventory.total;
  const rows=current.inventory.rows.filter(row=>!area||row.area===area).map(row=>{
   const value=aging?row.agedValue:row.value;
   return '<tr><th scope="row">'+html(row.section)+'<small>'+html(row.area)+'</small></th><td>'+date(row.cutoff)+'</td>'+
    (aging?'<td class="ic-aging-text">'+quantities(row)+'</td>':'')+
    '<td class="ic-money'+(aging?' ic-aging-text':'')+'">'+money(value)+'</td><td>'+share(value,total)+'</td><td>'+
    html(status(aging?row.agedStatus:row.status))+'</td></tr>';
  });
  const head=['Sección','Fecha de corte',...(aging?['Cantidad +90']:[]),aging?'Costo +90 (COP)':'Costo conocido (COP)',
   aging?'% del costo +90 consolidado':'% del costo consolidado','Cobertura'];
  return table(head,rows);
 }
 const reportButton=(id,label,attribute='')=>'<button type="button" class="ic-link" data-ic-view="'+id+'" '+attribute+'>'+label+'</button>';
 function areaFilter(selected){
  return '<label class="ic-filter">Área <select data-ic-area><option value="">Todas</option>'+
   inventoryAreas().map(({area})=>'<option'+(area===selected?' selected':'')+'>'+html(area)+'</option>').join('')+'</select></label>';
 }
 const inventoryAreas=()=>model.byArea(current.inventory.rows);
 function drawCurrent(body){
  const {inventory,ops,inv}=current,wip=ops.wipValue;
  body.innerHTML='<div class="ic-kpis">'+kpi('Costo consolidado',money(inventory.total),inventory.partial?'Valoración parcial · COP':'COP')+
   kpi('Costo de más de 90 días',money(inventory.agedTotal),share(inventory.agedTotal,inventory.total)+' del costo consolidado',true)+
   kpi('Valoración WIP',money(wip?.value),wip?wip.withCost+' de '+wip.ops+' OP con costo · '+date(wip.cutoff):'Sin corte de costo disponible')+
   kpi('Unidades PT sin costo',num(inv.missingCostUnits),'Cobertura de la valoración ERP')+'</div>'+
   '<article class="ic-card"><div class="ic-report-head"><div><h2>Costo de inventario por área</h2><p>Saldo al último corte de cada fuente · COP</p></div>'+
   reportButton('history','Ver histórico mensual ↗')+'</div>'+comparison(inventory.rows)+'</article>';
 }
 function drawSections(body){
  const {inventory}=current;
  const ranked=inventory.rows.filter(row=>row.value>0&&(!sectionArea||row.area===sectionArea)).sort((a,b)=>b.value-a.value);
  body.innerHTML='<article class="ic-card"><div class="ic-report-head"><div><h2>Participación en el costo consolidado</h2>'+
   '<p>Costo por sección y participación sobre el total del alcance seleccionado.</p></div>'+areaFilter(sectionArea)+'</div>'+
   (ranked.length?'<div class="ic-section-bars">'+ranked.map(row=>'<div><span>'+html(row.section)+'</span><strong>'+
    money(row.value)+' · '+share(row.value,inventory.total)+'</strong><div class="ic-track" aria-hidden="true"><i style="width:'+
    Math.min(100,row.value/inventory.total*100)+'%"></i></div></div>').join('')+'</div>':'')+
   sections(false,sectionArea)+'</article>';
 }
 function drawWip(body){
  const wip=current.ops.wipValue,stages=wip?.stages||[];
  body.innerHTML='<div class="ic-kpis">'+kpi('Costo WIP',money(wip?.value),'Corte '+date(wip?.cutoff))+
   kpi('Cobertura de valoración',wip?share(wip.withCost,wip.ops):'—',wip?wip.withCost+' de '+wip.ops+' OP con costo':'OP con costo')+
   kpi('Costo WIP de más de 90 días',money(wip?.agedValue),share(wip?.agedValue,wip?.value)+' del WIP valorado',true)+'</div>'+
   '<article class="ic-card"><h2>WIP por estado de producción</h2><p>Una OP que aparece en varios estados reparte el costo según las unidades de cada estado.</p>'+
   (wip?.withCost?'<dl class="ic-components">'+['Materia prima','Mano de obra','Costos indirectos'].map((name,i)=>
    '<div><dt>'+name+'</dt><dd>'+money(wip.components[i])+'</dd></div>').join('')+'</dl>':'')+
   (stages.length?table(['Estado','Unidades','Costo conocido (COP)','% del WIP valorado','OP con costo'],stages.map(row=>'<tr><th scope="row">'+html(row.name)+
    '</th><td>'+num(row.units)+'</td><td class="ic-money">'+money(row.value)+'</td><td>'+share(row.value,wip.value)+'</td><td>'+num(row.withCost)+' de '+num(row.ops)+'</td></tr>')):
    '<p class="ic-empty">No hay estados con valoración disponible para este alcance.</p>')+'</article>';
 }
 function drawAging(body){
  const {inventory}=current;
  body.innerHTML='<div class="ic-kpis">'+kpi('Costo conocido de más de 90 días',money(inventory.agedTotal),'COP · total parcial',true)+
   kpi('Participación sobre el inventario valorado',share(inventory.agedTotal,inventory.total),'Costo +90 sobre el total conocido',true)+
   kpi('Costo con edad indeterminada en Logística',money(current.log.unknown),'Saldo FIFO sin edad asignada')+'</div>'+
   '<article class="ic-card"><div class="ic-report-head"><div><h2>Inventario de más de 90 días por sección</h2>'+
   '<p>WIP desde la programación de la OP al corte de costos. Logística usa edad FIFO estimada.</p></div>'+
   areaFilter(agingArea)+'</div>'+sections(true,agingArea)+'</article>';
 }
 const month=key=>monthLabel.format(new Date(key+'-15T12:00:00Z'));
 function drawHistory(body){
  const keys=['pt','log'];
  const failed=keys.filter(key=>history[key].error).map(key=>sources[key]);
  const loading=keys.filter(key=>historyRequests.has(key)||(!history[key].cuts&&!history[key].error)).map(key=>sources[key]);
  const points=model.monthly({pt:history.pt.cuts,log:history.log.cuts,
   currentMonth:dateLabel.format(new Date()).slice(0,7),company,exact:exactClose});
  const graph=points.filter(point=>point.valued.length);
  const months=graph.length?points.filter(point=>point.month>=graph[0].month&&point.month<=graph.at(-1).month):[];
  const series=model.sources.filter(key=>graph.some(point=>finite(point.values[key]?.value)));
  const caption=[
   loading.length?'Consultando '+loading.join(' y ')+'…':'',
   failed.length?'No se pudo actualizar '+failed.join(' y ')+'.':''
  ].filter(Boolean).join(' ')||'Cortes publicados por Inventario PT y Logística.'+
   (embedded&&(current.filters.line.length||current.filters.category.length)?' Los cortes históricos se consultan por empresa.':'');
  const value=(p,key)=>{
   const item=p.values[key];
   return item?money(item.value)+(item.partial?' *':'')+'<small>'+date(item.cutoff)+' · '+(item.exact?'Cierre exacto':'Último corte del mes')+'</small>':'—';
  };
  const signed=n=>finite(n)?(n>0?'+':'')+money(n):'—';
  body.innerHTML='<article class="ic-card"><div class="ic-report-head"><div><h2>Histórico de inventario por mes</h2>'+
   '<p role="status">'+html(caption)+'</p></div><div class="ic-history-controls"><label class="ic-filter">Mostrar <select data-ic-close><option value="available"'+(!exactClose?' selected':'')+
   '>Cierre o último corte disponible</option><option value="exact"'+(exactClose?' selected':'')+'>Solo cierres exactos</option></select></label>'+
   (failed.length?'<button type="button" class="ic-link" data-ic-retry>Reintentar consulta</button>':'')+'</div></div>'+
   (months.length&&typeof Chart!=='undefined'?'<div class="ic-chart"><canvas role="img" aria-label="Costo de inventario por fuente y mes"></canvas></div>':
    !loading.length&&!months.length?'<p class="ic-empty">Sin meses con valoración para este criterio.</p>':'')+
   table(['Mes','WIP (COP)','Inventario PT (COP)','Logística (COP)','Subtotal comparable (COP)','Variación frente al mes anterior'],
    [...points].reverse().map(p=>'<tr><th scope="row">'+month(p.month)+'</th>'+model.sources.map(key=>'<td>'+value(p,key)+'</td>').join('')+
    '<td class="ic-money">'+money(p.total)+(p.valued.length?(p.sameCut?'<small>Parcial · '+p.valued.length+' de 3 fuentes</small>':'<small>Fechas distintas</small>'):'')+
    '</td><td>'+signed(p.delta)+(finite(p.rate)?'<small>'+percent.format(p.rate)+'</small>':'')+'</td></tr>'))+
   '<p class="ic-note">Un cierre exacto corresponde al último día calendario del mes. La variación exige dos cierres consecutivos con las mismas fuentes y sin costos parciales. * Valoración parcial. WIP publica su último corte y los históricos de tiendas están pendientes.</p></article>';
  const canvas=$('.ic-chart canvas');
  if(!canvas)return;
  chart=new Chart(canvas,{type:'bar',data:{labels:months.map(p=>month(p.month)),datasets:series.map(key=>({
   label:sources[key],data:months.map(p=>p.values[key]?.value??null),backgroundColor:{wip:'#537faa',pt:'#149687',log:'#526fa3'}[key],
   skipNull:true,borderRadius:3,maxBarThickness:52
  }))},options:{animation:false,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:value=>num(value/1e6)+' M'}},
   x:{ticks:{maxRotation:0},grid:{display:false}}},plugins:{legend:{labels:{usePointStyle:true,boxWidth:8}},
    tooltip:{callbacks:{label:ctx=>ctx.dataset.label+' · '+money(ctx.raw),
     afterLabel:ctx=>'Corte '+date(months[ctx.dataIndex].values[series[ctx.datasetIndex]]?.cutoff)}}}}});
 }
 const historyFrames={pt:'iframe-inventario',log:'iframe-logistica'};
 function refreshHistory(force=false){
  for(const [key,id] of Object.entries(historyFrames)){
   if(historyRequests.has(key)||(!force&&(history[key].cuts||history[key].error)))continue;
   const frame=document.getElementById(id)?.contentWindow;
   const source=key==='pt'?frame?.PccInventoryHistoryView:frame?.PccLogisticsHistory;
   if(!source){
    if(force)history[key].error=true;
    continue;
   }
   const request=Promise.resolve().then(()=>key==='pt'?source.costCuts(force):source.readIndex(force).then(index=>index.cuts))
    .then(cuts=>{history[key]={cuts};},()=>{history[key].error=true;})
    .finally(()=>{historyRequests.delete(key);if(view==='history')draw();});
   historyRequests.set(key,request);
  }
  if(force&&view==='history')draw();
  return Promise.all(historyRequests.values());
 }
 const reports={current:drawCurrent,sections:drawSections,aging:drawAging,wip:drawWip,history:drawHistory};
 function suspend(){chart?.destroy();chart=null;}
 function draw(){
  if(!current||!visible())return;
  const focused=['[data-ic-area]','[data-ic-close]'].find(selector=>document.activeElement?.matches(selector));
  suspend();
  root.querySelectorAll('.ic-nav [data-ic-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.icView===view)));
  reports[view]($('[data-ic-body]'));
  if(focused)$(focused)?.focus({preventScroll:true});
 }
 function render(snapshot,nextView){
  if(nextView)view=nextView;
  if(!visible())return;
  if(embedded){
   current=snapshot||current;
   const companies=current.filters.company;
   company=companies.length===1?companies[0]:'';
  }else{
   const {inv,log,wip}=PccExecutiveSource();
   current=PccAtlasModel.build({inv,log,wip},{company:company?[company]:[]});
  }
  if(view==='history')refreshHistory();
  draw();
 }
 root.addEventListener('click',event=>{
  if(event.target.closest('[data-ic-retry]')){
   $('.ic-nav [data-ic-view="history"]').focus({preventScroll:true});
   refreshHistory(true);
   return;
  }
  const button=event.target.closest('[data-ic-view]');
  if(!button)return;
  view=button.dataset.icView;
  render();
  $('.ic-nav [data-ic-view="'+view+'"]').focus({preventScroll:true});
 });
 root.addEventListener('change',event=>{
  if(event.target.matches('[data-ic-company]')){company=event.target.value;render();}
  if(event.target.matches('[data-ic-close]')){exactClose=event.target.value==='exact';draw();}
  if(event.target.matches('[data-ic-area]')){
   if(view==='sections')sectionArea=event.target.value;
   if(view==='aging')agingArea=event.target.value;
   draw();
  }
 });
 for(const id of Object.values(historyFrames)){
  document.getElementById(id)?.addEventListener('load',()=>{
   if(visible()&&view==='history')render();
  });
 }
 return {render,suspend,refreshHistory:()=>refreshHistory(true),
  print:()=>PccPrintView($('[data-ic-body]'),'Costo inventarios / '+pages[view],company?'Empresa '+company:'Todas las empresas')};
 }
 const page=createReport(document.getElementById('page-invcost'));
 window.PccInventoryCost={...page,comparison,mountModal:host=>createReport(host,true)};
 page.render();
})();
