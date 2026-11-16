(()=> {
 'use strict';
 const root=document.getElementById('page-invcost'),historyModel=PccInventoryCostModel;
 const $=selector=>root.querySelector(selector);
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
 const areas={wip:'WIP',pt:'Inventario PT',log:'Logística'};
 const pages={current:'Totales y participación',aging:'Más de 90 días',history:'Cierres mensuales'};
 let company='',view='current',exactClose=false,current,chart;
 let history={pt:null,log:null},pending=null;
 root.innerHTML='<header class="ic-header"><div><h1 tabindex="-1">Costo inventarios</h1><p>Valoración consolidada en pesos colombianos</p></div>'+
  '<label class="ic-filter">Empresa <select data-ic-company><option value="">Todas</option><option value="EU">EU</option><option value="TEX">TEX</option></select></label></header>'+
  '<div class="ic-nav" role="group" aria-label="Vistas de costo de inventarios">'+Object.entries(pages).map(([id,label])=>
   '<button type="button" data-ic-view="'+id+'" aria-pressed="'+(id===view)+'">'+label+'</button>').join('')+'</div>'+
  '<section data-ic-body aria-label="Vista de costo de inventarios"></section>';

 const kpi=(name,value,detail,alert=false)=>'<div class="ic-kpi'+(alert?' ic-alert':'')+'"><span>'+name+'</span><strong>'+value+
  '</strong><small>'+detail+'</small></div>';
 const table=(head,rows)=>'<div class="ic-scroll" tabindex="0" role="region" aria-label="Datos de inventario"><table><thead><tr>'+
  head.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
 const quantities=row=>row.agedQuantities?.length?row.agedQuantities.map(([unit,qty])=>num(qty)+' '+html(unit)).join('<br>'):num(row.agedUnits);
 function sections(aging){
  const total=aging?current.inventory.agedTotal:current.inventory.total;
  const rows=current.inventory.rows.map(row=>{
   const value=aging?row.agedValue:row.value;
   return '<tr><th scope="row">'+html(row.section)+'<small>'+html(row.area)+'</small></th><td>'+date(row.cutoff)+'</td>'+
    (aging?'<td class="ic-aging-text">'+quantities(row)+'</td>':'')+
    '<td class="ic-money'+(aging?' ic-aging-text':'')+'">'+money(value)+'</td><td>'+share(value,total)+'</td><td>'+
    html(status(aging?row.agedStatus:row.status))+'</td></tr>';
  });
  const head=['Sección','Fecha de corte',...(aging?['Cantidad +90']:[]),aging?'Costo +90 (COP)':'Costo conocido (COP)','% del saldo mostrado','Cobertura'];
  return table(head,rows);
 }
 function drawCurrent(body){
  const {inventory,ops,inv}=current;
  const wip=ops.wipValue;
  const stages=wip?.stages||[];
  const ranked=inventory.rows.filter(row=>row.value>0).sort((a,b)=>b.value-a.value);
  body.innerHTML='<div class="ic-kpis">'+kpi('Costo consolidado',money(inventory.total),inventory.partial?'Valorado parcial · cada fuente conserva su corte':'COP')+
   kpi('Costo de más de 90 días',money(inventory.agedTotal),share(inventory.agedTotal,inventory.total)+' del costo consolidado',true)+
   kpi('Valoración WIP',money(wip?.value),wip?wip.withCost+' de '+wip.ops+' OP con costo · '+date(wip.cutoff):'Sin corte de costo disponible')+
   kpi('Unidades PT sin costo',num(inv.missingCostUnits),'Cobertura de la valoración ERP')+'</div>'+
   '<div class="ic-grid"><article class="ic-card"><h2>Totales por etapa y sección</h2>'+sections(false)+'</article>'+
   '<article class="ic-card"><h2>Participación en el costo consolidado</h2>'+
   (ranked.length?'<div class="ic-bars">'+ranked.map(row=>'<div><span>'+html(row.section)+'</span><strong>'+share(row.value,inventory.total)+
    '</strong><div class="ic-track" aria-hidden="true"><i style="width:'+Math.min(100,row.value/inventory.total*100)+'%"></i></div></div>').join('')+'</div>':
    '<p class="ic-empty">No hay costos positivos informados para este alcance.</p>')+'</article></div>'+
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
   '<article class="ic-card"><h2>Inventario de más de 90 días por sección</h2><p>WIP desde la programación de la OP al corte de costos. Logística usa edad FIFO estimada.</p>'+
   sections(true)+'</article>';
 }
 const month=key=>monthLabel.format(new Date(key+'-15T12:00:00Z'));
 function drawHistory(body){
  const failed=['pt','log'].filter(key=>history[key]?.error).map(key=>areas[key]);
  const points=historyModel.monthly({pt:history.pt?.cuts,log:history.log?.cuts,
   currentMonth:dateLabel.format(new Date()).slice(0,7),company,exact:exactClose});
  const caption=pending?'Consultando archivos históricos…':failed.length?'Histórico no disponible para '+failed.join(' y ')+'. Usa Actualizar para reintentar.':'Cortes publicados por Inventario PT y Logística.';
  const value=(p,key)=>{
   const item=p.values[key];
   return item?money(item.value)+(item.partial?' *':'')+'<small>'+date(item.cutoff)+' · '+(item.exact?'Cierre exacto':'Último corte del mes')+'</small>':'—';
  };
  const signed=n=>finite(n)?(n>0?'+':'')+money(n):'—';
  body.innerHTML='<article class="ic-card"><div class="ic-history-head"><div><h2>Histórico de inventario por mes</h2>'+
   '<p role="status">'+html(caption)+'</p></div><label class="ic-filter">Mostrar <select data-ic-close><option value="available"'+(!exactClose?' selected':'')+
   '>Cierre o último corte disponible</option><option value="exact"'+(exactClose?' selected':'')+'>Solo cierres exactos</option></select></label></div>'+
   (points.some(p=>p.valued.length)?'<div class="ic-chart"><canvas role="img" aria-label="Costo de inventario por fuente y mes"></canvas></div>':
    '<p class="ic-empty">No hay meses con costo publicado para este criterio.</p>')+
   table(['Mes','WIP (COP)','Inventario PT (COP)','Logística (COP)','Subtotal comparable (COP)','Variación frente al mes anterior'],
    [...points].reverse().map(p=>'<tr><th scope="row">'+month(p.month)+'</th>'+historyModel.sources.map(key=>'<td>'+value(p,key)+'</td>').join('')+
    '<td class="ic-money">'+money(p.total)+(p.valued.length?(p.sameCut?'<small>Parcial · '+p.valued.length+' de 3 fuentes</small>':'<small>Fechas distintas</small>'):'')+
    '</td><td>'+signed(p.delta)+(finite(p.rate)?'<small>'+percent.format(p.rate)+'</small>':'')+'</td></tr>'))+
   '<p class="ic-note">Un cierre exacto corresponde al último día calendario del mes. La variación exige dos cierres consecutivos con las mismas fuentes y sin costos parciales. * Valoración parcial. WIP publica su último corte y los históricos de tiendas están pendientes.</p></article>';
  const canvas=$('.ic-chart canvas');
  if(!canvas||typeof Chart==='undefined')return;
  chart=new Chart(canvas,{type:'bar',data:{labels:points.map(p=>month(p.month)),datasets:historyModel.sources.map((key,i)=>({
   label:areas[key],data:points.map(p=>p.values[key]?.value??null),backgroundColor:['#537faa','#14a393','#8270aa'][i],borderRadius:3,maxBarThickness:30
  }))},options:{animation:false,maintainAspectRatio:false,scales:{y:{ticks:{callback:value=>num(value/1e6)+' M'}},
   x:{ticks:{maxRotation:0}}},plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label+' · '+money(ctx.raw),
    afterLabel:ctx=>'Corte '+date(points[ctx.dataIndex].values[historyModel.sources[ctx.datasetIndex]]?.cutoff)}}}}});
 }
 async function refreshHistory(force=false){
  if(pending)return pending;
  const methods={
   pt:()=>document.getElementById('iframe-inventario')?.contentWindow?.PccInventoryHistoryView?.costCuts(force),
   log:async()=> (await document.getElementById('iframe-logistica')?.contentWindow?.PccLogisticsHistory?.readIndex(force))?.cuts
  };
  const keys=Object.keys(methods).filter(key=>force||!history[key]||history[key].waiting);
  if(!keys.length)return;
  pending=Promise.all(keys.map(async key=>{
   try{const cuts=await methods[key]();history[key]=Array.isArray(cuts)?{cuts}:{waiting:true};}
   catch{history[key]={error:true};}
  })).finally(()=>{pending=null;if(view==='history'&&!root.hidden)draw();});
  if(view==='history'&&!root.hidden)draw();
  return pending;
 }
 function draw(){
  if(!current||root.hidden)return;
  chart?.destroy();chart=null;
  root.querySelectorAll('[data-ic-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.icView===view)));
  const body=$('[data-ic-body]');
  if(view==='current')drawCurrent(body);
  else if(view==='aging')drawAging(body);
  else drawHistory(body);
 }
 function render(){
  if(root.hidden)return;
  const {inv,log,wip}=PccExecutiveSource();
  current=PccAtlasModel.build({inv,log,wip},{company:company?[company]:[]});
  draw();
  if(view==='history')refreshHistory();
 }
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-ic-view]');
  if(!button)return;
  view=button.dataset.icView;
  render();
 });
 root.addEventListener('change',event=>{
  if(event.target.matches('[data-ic-company]')){company=event.target.value;render();}
  if(event.target.matches('[data-ic-close]')){exactClose=event.target.value==='exact';draw();$('[data-ic-close]').focus();}
 });
 window.PccInventoryCost={render,refreshHistory:()=>refreshHistory(true),
  print:()=>PccPrintView($('[data-ic-body]'),'Costo inventarios / '+pages[view],company?'Empresa '+company:'Todas las empresas')};
 render();
})();
