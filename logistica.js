(()=>{'use strict';
const M=window.PccLogisticsModel,$=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
const compactFmt=new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1});
const state={stock:[],moves:[],age:[],ageMessage:'Pendiente de publicación FIFO en Apps Script',meta:null};
const charts={};
if(typeof Chart!=='undefined'&&typeof ChartDataLabels!=='undefined')Chart.register(ChartDataLabels);
let materialPage=0,coveragePage=0,agePage=0,stockAgePage=0;
let docsMode='rows';
let monthlyMode='quantity',detailCode='',detailLimit=100;
const pageSize=100;
const n=v=>{const x=Number(v);if(!Number.isFinite(x))throw Error('Valor numérico inválido en la hoja');return x};
const str=v=>String(v==null?'':v).trim();
const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>fmt.format(v||0);
const money=v=>'$ '+fmt.format(v||0);
const moneyCompact=v=>'$ '+compactFmt.format(v||0);
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'—';
const G=window.PccLogisticsGrid;
const col=(label,key,type='text')=>({label,type,get:r=>r[key]});
const materialGrid=G.create('materialsTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Referencia','ref'),
  col('Material','name'),col('U. M.','unit','enum'),col('Físico','physical','number'),
  col('Comprometido','committed','number'),col('Disponible','available','number'),
  col('Valor','costTotal','number')],()=>{materialPage=0;renderMaterials()});
const coverageGrid=G.create('coverageTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Referencia','ref'),
  col('Material','name'),col('Unidad','unit','enum'),col('Físico','physical','number'),
  col('Consumo neto','consumption','number'),col('Días','coverageDays','number'),
  col('Categoría','coverageCategory','enum'),col('Valor','costTotal','number')],
  ()=>{coveragePage=0;renderCoverage()});
const ageGrid=G.create('ageTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Referencia','ref'),
  col('Material','name'),col('Unidad','unit','enum'),col('Físico','physical','number'),
  col('Valor','costTotal','number'),col('Último CPN','lastConsumption'),
  col('Días','daysSinceConsumption','number'),col('Tramo','consumptionCategory','enum')],
  ()=>{agePage=0;renderAge()});
const stockAgeGrid=G.create('stockAgeTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Referencia','ref'),
  col('Material','name'),col('Unidad','unit','enum'),col('Físico','physical','number'),
  col('Valor','value','number'),
  ...[0,1,2,3,4].map((index)=>({label:['0–30','31–60','61–90','+90','Sin edad'][index],type:'number',get:r=>r.qty[index]})),
  col('Valor +90','riskValue','number'),col('Estado','status','enum')],
  ()=>{stockAgePage=0;renderStockAge()});
const warehouseGrid=G.create('warehousesTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Posiciones','positions','number'),
  col('Valor','value','number'),col('Físico','physical','number'),
  col('Comprometido','committed','number'),col('Disponible','available','number')],render);
const docsGrid=G.create('docsTable',[
  col('Documento','name','enum'),col('Filas','rows','number'),col('Con entrada','inRows','number'),
  col('Con salida','outRows','number'),col('Cantidad entrada','inQty','number'),
  col('Cantidad salida','outQty','number'),col('Costo entrada','inCost','number'),
  col('Costo salida','outCost','number')],render);
const productionGrid=G.create('productionTable',[
  {label:'Empresa / referencia',type:'text',get:r=>r.company+' '+r.ref},
  col('Material','name'),col('Neto','net','number'),
  col('Valor neto','netCost','number')],render,{sortable:false});
const receiptsGrid=G.create('receiptsTable',[
  {label:'Empresa / referencia',type:'text',get:r=>r.company+' '+r.ref},
  col('Material','name'),col('Recibido','qty','number'),
  col('Valor entrada','value','number')],render,{sortable:false});
const monthlyGrid=G.create('monthlyTable',[
  col('Mes','month'),col('Fechas incluidas','period'),col('Consumo neto','consumption','number'),col('Corte disponible','cutoff'),
  col('Índice parcial','partial','number'),col('Estado','status','enum')],renderRotation);
function status(message,kind=''){
  $('status').textContent=message;$('status').className='banner'+(kind?' '+kind:'');
  $('stateTag').className='live-pill'+(kind?' '+kind:'');
  $('stateTag').textContent=kind==='error'?'SIN DATOS':kind==='warn'?'EN CONSTRUCCIÓN':
    kind==='stale'?'DATOS ANTERIORES':kind==='loading'?'ACTUALIZANDO':'DATOS CONECTADOS';
}
function table(id,html,colspan=7){$(id).innerHTML=html||'<tr><td colspan="'+colspan+'" class="empty">Sin registros para estos filtros</td></tr>'}
function scope(){return {company:$('company').value,type:$('type').value,warehouse:$('warehouse').value}}
function unit(){return $('unit').value}
function movementRange(){
  const min=state.meta.movimientos_desde,max=state.meta.movimientos_hasta;
  const clamp=value=>value&&value>=min&&value<=max?value:min;
  const from=clamp($('movementFrom').value),to=$('movementTo').value>=min&&$('movementTo').value<=max?
    $('movementTo').value:max;
  return {from,to:to<from?from:to};
}
function syncMovementRange(){
  const min=state.meta.movimientos_desde,max=state.meta.movimientos_hasta;
  const from=$('movementFrom'),to=$('movementTo');
  for(const control of [from,to]){control.min=min;control.max=max;}
  if(!from.value||from.value<min||from.value>max)from.value=min;
  if(!to.value||to.value<min||to.value>max)to.value=max;
  if(from.value>to.value){from.value=min;to.value=max;}
  $('movementWindow').textContent='Disponible: '+min+' a '+max+' · fechas incluidas.';
}
function fillUnits(){
  const units=[...new Set(state.stock.concat(state.moves).map(r=>r.unit).filter(Boolean))].sort();
  const previous=$('unit').value;
  $('unit').innerHTML=units.map(u=>'<option value="'+esc(u)+'">'+esc(u)+'</option>').join('');
  if(units.includes(previous))$('unit').value=previous;else if(units.includes('MT'))$('unit').value='MT';
}
function fillWarehouseUnits(){
  for(const [id,warehouse,preferred] of [['fabricUnit','MT001','MT'],['supplyUnit','MT002','UND']]){
    const select=$(id),previous=select.value,company=$('company').value;
    const units=[...new Set(state.stock.filter(r=>r.warehouse===warehouse&&
      (company==='all'||r.company===company)).map(r=>r.unit))].sort();
    select.innerHTML=units.map(u=>'<option value="'+esc(u)+'">'+esc(u)+'</option>').join('');
    select.value=units.includes(previous)?previous:units.includes(preferred)?preferred:units[0]||'';
  }
}
function fillRotationUnits(preferDefault=false){
  const s=scope(),allowed=['MT001','MT002'].filter(warehouse=>
    state.stock.some(r=>r.warehouse===warehouse&&M.matchScope(r,s)));
  const warehouse=$('rotWarehouse');
  for(const option of warehouse.options)option.disabled=!allowed.includes(option.value);
  if(!allowed.includes(warehouse.value)){warehouse.value=allowed[0]||'MT001';preferDefault=true}
  const units=[...new Set(state.stock.filter(r=>r.warehouse===warehouse.value&&M.matchScope(r,s))
    .map(r=>r.unit))].sort(),select=$('rotUnit'),previous=select.value;
  select.innerHTML=units.map(u=>'<option value="'+esc(u)+'">'+esc(u)+'</option>').join('');
  select.value=!preferDefault&&units.includes(previous)?previous:units.includes(warehouse.value==='MT001'?'MT':'UND')?
    (warehouse.value==='MT001'?'MT':'UND'):units[0]||'';
}
function monthsInRange(from,to){
  const out=[],start=new Date(from.slice(0,7)+'-01T00:00:00Z');
  for(let d=start;d.toISOString().slice(0,7)<=to.slice(0,7);d=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)))
    out.push(d.toISOString().slice(0,7));
  return out;
}
function activePage(){return document.querySelector('.nav-btn.active')?.dataset.page||'resumen'}
function setPage(name){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+name));
  document.querySelector('.filter-bar').classList.toggle('purchases-only',name==='compras');
  window.scrollTo(0,0);
  renderCharts();
  if(name==='compras')window.PccLogisticsPurchases?.render();
}
function chart(id,type,data,options){
  if(charts[id])charts[id].destroy();
  if(typeof Chart==='undefined'){
    $(id).hidden=true;
    let note=$(id).parentElement.querySelector('.chart-unavailable');
    if(!note){
      note=document.createElement('p');note.className='chart-unavailable';
      note.textContent='No se pudo cargar el gráfico. Los datos siguen disponibles en la tabla de esta sección.';
      $(id).parentElement.append(note);
    }
    return;
  }
  $(id).hidden=false;
  const base={
    responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{labels:{font:{family:'DM Sans',size:10},boxWidth:11}},
      tooltip:{mode:'index',intersect:false},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'end',
        color:'#1B3A5C',clip:true,font:{family:'DM Sans',size:9,weight:700},formatter:num}},
    scales:{x:{ticks:{font:{family:'DM Sans',size:10},color:'#6B7A8D'},grid:{display:false}},
      y:{beginAtZero:true,ticks:{font:{family:'DM Sans',size:10},color:'#6B7A8D'},grid:{color:'#E2E8F0'}}}
  };
  charts[id]=new Chart($(id),{type,data,options:{...base,...options,
    plugins:{...base.plugins,...options.plugins},
    scales:{...base.scales,...options.scales}
  }});
}
function warehouseGroups(stock){
  const groups=[];
  for(const co of ['EU','TEX'])for(const wh of ['MT001','MT002']){
    const rows=stock.filter(r=>r.company===co&&r.warehouse===wh);
    if(rows.length)groups.push({label:co+' · '+M.WAREHOUSES[wh],summary:M.stockSummary(rows)});
  }
  return groups;
}
function renderCharts(){
  if(!state.meta)return;
  const s=scope(),u=unit(),stock=state.stock.filter(r=>M.matchScope(r,s));
  const groups=warehouseGroups(stock);
  if(activePage()==='resumen'){
    chart('chartWarehouse','bar',{
      labels:groups.map(g=>g.label),
      datasets:[{label:'Valor según SIESA',data:groups.map(g=>g.summary.value),backgroundColor:['#1B3A5C','#0D6B5E','#4E6F98','#36A38E'],borderRadius:4}]
    },{indexAxis:'y',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>money(c.parsed.x)}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'start',
        color:'#fff',font:{family:'DM Sans',size:10,weight:700},
        formatter:(v,context)=>context?.chart?.width<650?moneyCompact(v):money(v)}},
      scales:{x:{beginAtZero:true,ticks:{callback:v=>moneyCompact(v)}}}});
    for(const [id,warehouse,selectId] of [['chartFabric','MT001','fabricUnit'],['chartSupply','MT002','supplyUnit']]){
      const card=$(id).closest('.chart-card');
      card.hidden=!stock.some(r=>r.warehouse===warehouse);
      if(card.hidden){if(charts[id])charts[id].destroy();delete charts[id];continue}
      const selected=$(selectId).value;
      const byCompany=['EU','TEX'].filter(company=>s.company==='all'||s.company===company)
        .map(company=>({company,summary:M.stockSummary(stock.filter(r=>r.company===company&&
          r.warehouse===warehouse&&r.unit===selected))}));
      const selectedSummary=M.stockSummary(stock.filter(r=>r.warehouse===warehouse&&r.unit===selected));
      $(warehouse==='MT001'?'fabricSummary':'supplySummary').textContent=
        'Físico '+num(selectedSummary.quantity[selected])+' '+selected+' · Comprometido '+
        num(selectedSummary.committed[selected])+' '+selected+' · Disponible '+
        num(selectedSummary.available[selected])+' '+selected;
      chart(id,'bar',{labels:byCompany.map(g=>g.company+' · '+M.WAREHOUSES[warehouse]),datasets:[
        {label:'Disponible · '+selected,data:byCompany.map(g=>g.summary.available[selected]||0),backgroundColor:'#0D6B5E',borderRadius:3},
        {label:'Comprometido · '+selected,data:byCompany.map(g=>g.summary.committed[selected]||0),backgroundColor:'#C07A00',borderRadius:3}
      ]},{indexAxis:'y',layout:{padding:{right:100}},plugins:{datalabels:{
        display:c=>Number(c.dataset.data[c.dataIndex])>0,
        anchor:c=>c.datasetIndex===0?'center':'end',align:c=>c.datasetIndex===0?'center':'end',
        color:c=>c.datasetIndex===0?'#fff':'#92400e',clip:false,
        font:{family:'DM Sans',size:10,weight:700},formatter:v=>num(v)+' '+selected}},
        scales:{x:{stacked:true,beginAtZero:true},y:{stacked:true,grid:{display:false}}}});
    }
  }
  if(activePage()==='movimientos'){
    const {from,to}=movementRange(),moves=M.movementRows(state.moves,s,from,to);
    const ms=M.movementSummary(moves,u),codes=['CPN','EAC','DCN','RM','DCP','AIC','EIV','ENS'].filter(k=>ms.codes[k]);
    const byQuantity=docsMode==='quantity';
    $('docsChartCaption').textContent=byQuantity?
      'Cantidad movida en '+u+' · entradas y salidas por documento. No se mezclan unidades.':
      'Conteo de filas con entrada y salida; incluye todas las unidades.';
    chart('chartDocs','bar',{
      labels:codes,
      datasets:[
        {label:byQuantity?'Entrada · '+u:'Filas con entrada',data:codes.map(k=>ms.codes[k][byQuantity?'inQty':'inRows']),backgroundColor:'#0D6B5E',borderRadius:3},
        {label:byQuantity?'Salida · '+u:'Filas con salida',data:codes.map(k=>ms.codes[k][byQuantity?'outQty':'outRows']),backgroundColor:'#1B3A5C',borderRadius:3}
      ]
    },{plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+num(c.parsed.y)+(byQuantity?' '+u:'')}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'end',
        color:'#1B3A5C',clip:true,font:{family:'DM Sans',size:9,weight:700},
        formatter:v=>num(v)+(byQuantity?' '+u:'')}},
      scales:{y:{beginAtZero:true,ticks:{callback:v=>num(v)+(byQuantity?' '+u:'')}}}});
    const monthly=M.monthlyMovements(moves,from,to,u),byValue=monthlyMode==='value';
    chart('chartMonthlyMovements','bar',{labels:monthly.map(r=>r.month+(r.partial?' *':'')),datasets:[
      {label:byValue?'Entradas · costo $':'Entradas · '+u,
        data:monthly.map(r=>r[byValue?'inCost':'inQty']),backgroundColor:'#0D6B5E',borderRadius:3},
      {label:byValue?'Salidas · costo $':'Salidas · '+u,
        data:monthly.map(r=>r[byValue?'outCost':'outQty']),backgroundColor:'#1B3A5C',borderRadius:3}
    ]},{plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+(byValue?money(c.parsed.y):num(c.parsed.y)+' '+u)}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'end',
        color:'#1B3A5C',clip:true,font:{family:'DM Sans',size:9,weight:700},
        formatter:v=>byValue?moneyCompact(v):num(v)+' '+u}},
      scales:{y:{beginAtZero:true,ticks:{callback:v=>byValue?moneyCompact(v):num(v)+' '+u}}}});
  }
  if(activePage()==='rotacion'){
    const rows=coverageRows(false),labels=['Bajo 40,5 d','En meta','Sobre 49,5 d','Sin consumo neto en período','Sin existencia'];
    chart('chartCoverage','bar',{labels,datasets:[{label:'Referencias',data:labels.map(k=>rows.filter(r=>r.coverageCategory===k).length),
      backgroundColor:['#B03030','#0D6B5E','#C07A00','#6B7A8D','#A6B3C1'],borderRadius:4}]},
    {plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}});
    const months=monthlyRows();
    chart('chartMonthlyConsumption','bar',{labels:months.map(r=>r.month+(r.partialMonth?' *':'')),datasets:[{
      label:'Consumo neto · '+$('rotUnit').value,data:months.map(r=>r.consumption),
      backgroundColor:months.map(r=>r.cutoff==='—'?'#8BBDB3':'#0D6B5E'),borderRadius:4}]},
    {plugins:{legend:{display:false},datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,
      anchor:'end',align:'end',color:'#1B3A5C',font:{family:'DM Sans',size:9,weight:700},
      formatter:v=>num(v)+' '+$('rotUnit').value}},scales:{y:{beginAtZero:true}}});
  }
  if(activePage()==='antiguedad'){
    if(state.age.length){
      const age=stockAgeRows(false),groups=['EU · Telas','EU · Insumos','TEX · Telas','TEX · Insumos'];
      chart('chartStockAge','bar',{labels:groups,datasets:[
        '0–30','31–60','61–90','+90','Sin edad'].map((label,index)=>({label,
          data:groups.map(group=>age.filter(r=>group.startsWith(r.company)&&
            group.endsWith(M.WAREHOUSES[r.warehouse])).reduce((sum,r)=>sum+r.values[index],0)),
          backgroundColor:['#1E7A40','#C07A00','#E07020','#B03030','#6B46C1'][index],borderRadius:2}))},
      {indexAxis:'y',plugins:{datalabels:{display:c=>{
        const value=Number(c.dataset.data[c.dataIndex]),total=c.chart.data.datasets.reduce((sum,d)=>sum+Number(d.data[c.dataIndex]||0),0);
        return value>0&&total>0&&value/total>=0.075;},anchor:'center',align:'center',color:'#fff',
        font:{family:'DM Sans',size:9,weight:700},formatter:v=>moneyCompact(v)},
        tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.parsed.x)}}},
        scales:{x:{stacked:true,ticks:{callback:v=>moneyCompact(v)}},y:{stacked:true,grid:{display:false}}}});
    }
    const rows=ageRows(false),labels=['0–30 días','31–60 días','61–90 días','+90 días','Sin CPN en 90 días'];
    chart('chartConsumptionAge','bar',{labels,datasets:[{label:'Referencias',
      data:labels.map(k=>rows.filter(r=>r.consumptionCategory===k).length),
      backgroundColor:['#1E7A40','#C07A00','#E07020','#B03030','#6B7A8D'],borderRadius:4}]},
    {plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}});
  }
}
function materialRows(){
  const s=scope(),q=str($('materialSearch').value).toLocaleLowerCase('es');
  return materialGrid.apply(state.stock.filter(r=>M.matchScope(r,s)&&(!q||(r.ref+' '+r.name).toLocaleLowerCase('es').includes(q)))
    .sort((a,b)=>a.company.localeCompare(b.company)||a.warehouse.localeCompare(b.warehouse)||a.ref.localeCompare(b.ref)));
}
function renderMaterials(){
  const rows=materialRows(),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  materialPage=Math.min(materialPage,pages-1);
  $('materialCount').textContent=num(rows.length)+' posiciones · página '+(materialPage+1)+' de '+pages;
  const visible=rows.slice(materialPage*pageSize,(materialPage+1)*pageSize);
  table('materials',visible.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.warehouse)+' · '+esc(M.WAREHOUSES[r.warehouse])+
    '</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+
    '</td><td class="num">'+num(r.committed)+'</td><td class="num">'+num(r.available)+
    '</td><td class="num">'+money(r.costTotal)+'</td></tr>').join(''),9);
  $('materialsFooter').innerHTML='<tr><td colspan="8">TOTAL FILTRADO · '+num(rows.length)+' posiciones · cantidades por unidad</td><td class="num">'+
    money(rows.reduce((total,r)=>total+r.costTotal,0))+'</td></tr>';
  $('materialPrev').disabled=materialPage===0;
  $('materialNext').disabled=materialPage>=pages-1;
}
function coverageRows(applyFilters=true){
  if(!state.meta)return [];
  const s=scope(),stock=state.stock.filter(r=>M.matchScope(r,s));
  const moves=state.moves.filter(r=>M.matchScope(r,s));
  let rows=M.coverage(stock,moves,state.meta.movimientos_desde,state.meta.corte_inventario);
  if(applyFilters){
    const q=str($('coverageSearch').value).toLocaleLowerCase('es'),category=$('coverageCategory').value;
    rows=rows.filter(r=>(category==='all'||r.coverageCategory===category)&&
      (!q||(r.ref+' '+r.name).toLocaleLowerCase('es').includes(q)));
  }
  rows.sort((a,b)=>(b.coverageDays??-1)-(a.coverageDays??-1)||
    a.company.localeCompare(b.company)||a.ref.localeCompare(b.ref));
  return applyFilters?coverageGrid.apply(rows):rows;
}
function renderCoverage(){
  const all=coverageRows(false),rows=coverageRows(),days=M.periodDays(state.meta.movimientos_desde,state.meta.corte_inventario);
  $('coverageCaption').textContent='Existencia física ÷ consumo neto diario CPN − DCN · '+
    state.meta.movimientos_desde+' a '+state.meta.corte_inventario+' · '+(days??'—')+' días calendario.';
  const categories=['Bajo 40,5 d','En meta','Sobre 49,5 d','Sin consumo neto en período','Sin existencia'];
  $('coverageSummary').innerHTML=categories.map((label,i)=>'<div class="coverage-chip c'+i+'"><strong>'+num(all.filter(r=>r.coverageCategory===label).length)+
    '</strong><span>'+label+'</span></div>').join('');
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));coveragePage=Math.min(coveragePage,pages-1);
  $('coverageCount').textContent=num(rows.length)+' referencias · página '+(coveragePage+1)+' de '+pages;
  table('coverageRows',rows.slice(coveragePage*pageSize,(coveragePage+1)*pageSize).map(r=>
    '<tr><td>'+esc(r.company)+'</td><td>'+esc(r.warehouse)+'</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+
    '</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+'</td><td class="num">'+num(r.consumption)+
    '</td><td class="num">'+(r.coverageDays===null?'—':num(r.coverageDays))+'</td><td><span class="status-badge '+
    (r.coverageCategory==='En meta'?'ok':r.coverageCategory==='Bajo 40,5 d'?'bad':
      r.coverageCategory==='Sobre 49,5 d'?'warn':'')+'">'+esc(r.coverageCategory)+
    '</span></td><td class="num">'+money(r.costTotal)+'</td></tr>').join(''),10);
  $('coverageFooter').innerHTML='<tr><td colspan="9">TOTAL FILTRADO · '+num(rows.length)+' referencias · cantidades por unidad</td><td class="num">'+
    money(rows.reduce((total,r)=>total+r.costTotal,0))+'</td></tr>';
  $('coveragePrev').disabled=coveragePage===0;$('coverageNext').disabled=coveragePage>=pages-1;
}
function ageRows(applyFilters=true){
  if(!state.meta)return [];
  const s=scope(),from=state.meta.movimientos_desde,to=state.meta.corte_inventario;
  let rows=M.consumptionAge(state.stock.filter(r=>M.matchScope(r,s)),
    state.moves.filter(r=>M.matchScope(r,s)),from,to);
  if(applyFilters){
    const q=str($('ageSearch').value).toLocaleLowerCase('es'),category=$('ageCategory').value;
    rows=rows.filter(r=>(category==='all'||r.consumptionCategory===category)&&
      (!q||(r.ref+' '+r.name).toLocaleLowerCase('es').includes(q)));
  }
  rows.sort((a,b)=>(a.lastConsumption===null?0:1)-(b.lastConsumption===null?0:1)||
    (b.daysSinceConsumption??0)-(a.daysSinceConsumption??0)||b.costTotal-a.costTotal);
  return applyFilters?ageGrid.apply(rows):rows;
}
function stockAgeRows(applyFilters=true){
  let rows=state.age.filter(r=>M.matchScope(r,scope()));
  if(applyFilters){
    const query=str($('stockAgeSearch').value).toLocaleLowerCase('es'),category=$('stockAgeCategory').value;
    rows=rows.filter(r=>(category==='all'||r.qty[Number(category)-7]>0)&&
      (!query||(r.ref+' '+r.name).toLocaleLowerCase('es').includes(query)));
  }
  rows.sort((a,b)=>b.riskValue-a.riskValue||b.value-a.value||a.ref.localeCompare(b.ref));
  return applyFilters?stockAgeGrid.apply(rows):rows;
}
function renderStockAge(){
  const labels=['0–30 días','31–60 días','61–90 días','+90 días','Sin edad determinada'];
  const all=stockAgeRows(false),ready=state.age.length>0;
  $('stockAgeBuckets').innerHTML=labels.map((label,index)=>{
    const value=all.reduce((sum,r)=>sum+r.values[index],0);
    return '<div class="metric-card '+['green','amber','amber','red','purple'][index]+'"><small>'+label+
      '</small><strong>'+(ready?money(value):'—')+'</strong><span>'+(
        ready?'Cantidad separada por unidad en la tabla':'Pendiente de publicación')+'</span></div>';
  }).join('');
  $('stockAgeStatus').textContent=ready?
    'Estimación FIFO al corte '+date(state.meta.corte_inventario)+'. +90 días indica saldo envejecido estimado, no una baja contable por obsolescencia. '+
    num(all.filter(r=>r.status==='NO_CONCILIA').length)+' referencias sin conciliación individual.':state.ageMessage;
  $('stockAgePanel').hidden=!ready;
  $('stockAgeChartPanel').hidden=!ready;
  if(!ready)return;
  const groups=[['EU','MT001'],['EU','MT002'],['TEX','MT001'],['TEX','MT002']];
  table('stockAgeMatrix',groups.filter(([company,warehouse])=>all.some(r=>r.company===company&&r.warehouse===warehouse))
    .map(([company,warehouse])=>{
      const selected=all.filter(r=>r.company===company&&r.warehouse===warehouse),
        values=[0,1,2,3,4].map(index=>selected.reduce((sum,r)=>sum+r.values[index],0));
      return '<tr><td>'+esc(company+' · '+M.WAREHOUSES[warehouse])+'</td>'+values.map(value=>
        '<td class="num">'+money(value)+'</td>').join('')+'<td class="num">'+
        money(values.reduce((sum,value)=>sum+value,0))+'</td></tr>';
    }).join(''),7);
  const rows=stockAgeRows(),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  stockAgePage=Math.min(stockAgePage,pages-1);
  $('stockAgeCount').textContent=num(rows.length)+' referencias · página '+(stockAgePage+1)+' de '+pages;
  table('stockAgeRows',rows.slice(stockAgePage*pageSize,(stockAgePage+1)*pageSize).map(r=>
    '<tr><td>'+esc(r.company)+'</td><td>'+esc(r.warehouse)+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+
    '</td><td class="num">'+money(r.value)+'</td>'+r.qty.map(q=>'<td class="num">'+num(q)+'</td>').join('')+
    '<td class="num">'+money(r.riskValue)+'</td><td><span class="status-badge '+
    (r.status==='NO_CONCILIA'?'bad':'ok')+'">'+esc(r.status==='NO_CONCILIA'?'Revisar':'FIFO')+
    '</span></td></tr>').join(''),14);
  $('stockAgeFooter').innerHTML='<tr><td colspan="6">TOTAL FILTRADO · '+num(rows.length)+
    ' referencias · cantidades por unidad</td><td class="num">'+money(rows.reduce((sum,r)=>sum+r.value,0))+
    '</td><td colspan="5"></td><td class="num">'+money(rows.reduce((sum,r)=>sum+r.riskValue,0))+
    '</td><td></td></tr>';
  $('stockAgePrev').disabled=stockAgePage===0;$('stockAgeNext').disabled=stockAgePage>=pages-1;
}
function renderMonthlyMovements(moves,from,to,selectedUnit){
  const rows=M.monthlyMovements(moves,from,to,selectedUnit),byValue=monthlyMode==='value';
  const inKey=byValue?'inCost':'inQty',outKey=byValue?'outCost':'outQty';
  const format=v=>byValue?money(v):num(v)+' '+selectedUnit;
  $('movementMonthlyCaption').textContent=from+' a '+to+' · * mes parcial. '+
    (byValue?'Costos de todos los movimientos y unidades seleccionados por empresa/bodega.':
      'Cantidades solo en '+selectedUnit+'; registros de todas las unidades.');
  table('movementMonthlyRows',rows.map(r=>'<tr><td>'+esc(r.month)+(r.partial?' *':'')+
    '</td><td>'+esc(r.from+' a '+r.to)+'</td><td class="num">'+num(r.rows)+
    '</td><td class="num">'+format(r[inKey])+'</td><td class="num">'+format(r[outKey])+'</td></tr>').join(''),5);
  $('movementMonthlyFooter').innerHTML='<tr><td colspan="2">TOTAL DEL RANGO</td><td class="num">'+
    num(rows.reduce((sum,r)=>sum+r.rows,0))+'</td><td class="num">'+
    format(rows.reduce((sum,r)=>sum+r[inKey],0))+'</td><td class="num">'+
    format(rows.reduce((sum,r)=>sum+r[outKey],0))+'</td></tr>';
}
function detailRows(){
  if(!state.meta||!detailCode)return [];
  const {from,to}=movementRange();
  return M.movementRows(state.moves,scope(),from,to).filter(r=>r.docType===detailCode);
}
function renderMovementDetail(){
  const rows=detailRows(),visible=rows.slice(0,detailLimit),totals=M.movementSummary(rows);
  $('movementDetailTitle').textContent=detailCode+' · '+(M.TYPES[detailCode]||'Tipo de documento');
  const {from,to}=movementRange();
  $('movementDetailCaption').textContent=from+' a '+to+' · '+num(rows.length)+' registros en los filtros actuales';
  table('movementDetailRows',visible.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.company)+
    '</td><td>'+esc(r.warehouse)+'</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+
    '</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.inQty)+' '+esc(r.unit)+
    '</td><td class="num">'+num(r.outQty)+' '+esc(r.unit)+
    '</td><td class="num">'+money(r.inCost)+'</td><td class="num">'+money(r.outCost)+'</td></tr>').join(''),10);
  $('movementDetailTotal').textContent='Mostrando '+num(visible.length)+' de '+num(rows.length)+
    ' · costo entrada '+money(totals.inCost)+' · costo salida '+money(totals.outCost);
  $('movementDetailMore').hidden=visible.length===rows.length;
}
function openMovementDetail(code){
  if(!M.TYPES[code])return;
  detailCode=code;detailLimit=100;renderMovementDetail();$('movementDetail').showModal();
}
function renderAge(){
  if(!state.meta)return;
  const all=ageRows(false),rows=ageRows(),from=state.meta.movimientos_desde,to=state.meta.corte_inventario;
  $('ageCaption').textContent='Último CPN observado del '+from+' al '+to+
    ' · '+M.periodDays(from,to)+' días calendario. El tramo describe tiempo sin consumo registrado, no edad del saldo.';
  const categories=['0–30 días','31–60 días','61–90 días','+90 días','Sin CPN en 90 días'];
  $('consumptionAgeBuckets').innerHTML=categories.map((category,index)=>{
    const matches=all.filter(r=>r.consumptionCategory===category);
    return '<div class="metric-card '+(['green','amber','amber','red','red'][index])+'"><small>'+esc(category)+
      '</small><strong>'+num(matches.length)+'</strong><span>'+money(matches.reduce((a,r)=>a+r.costTotal,0))+
      ' en existencias</span></div>';
  }).join('');
  $('ageRiskValue').textContent='Valor con existencia positiva y sin CPN en 90 días: '+
    money(all.filter(r=>r.consumptionCategory==='Sin CPN en 90 días').reduce((a,r)=>a+r.costTotal,0))+'.';
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));agePage=Math.min(agePage,pages-1);
  $('ageCount').textContent=num(rows.length)+' referencias · página '+(agePage+1)+' de '+pages;
  table('ageRows',rows.slice(agePage*pageSize,(agePage+1)*pageSize).map(r=>'<tr><td>'+esc(r.company)+
    '</td><td>'+esc(r.warehouse)+'</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+
    '</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+'</td><td class="num">'+
    money(r.costTotal)+'</td><td>'+esc(r.lastConsumption||'—')+'</td><td class="num">'+
    (r.daysSinceConsumption===null?'—':num(r.daysSinceConsumption))+'</td><td><span class="status-badge '+
    (r.consumptionCategory==='Sin CPN en 90 días'||r.consumptionCategory==='+90 días'?'bad':
      r.consumptionCategory==='0–30 días'?'ok':'warn')+'">'+esc(r.consumptionCategory)+
    '</span></td></tr>').join(''),10);
  $('ageFooter').innerHTML='<tr><td colspan="6">TOTAL FILTRADO · '+num(rows.length)+' referencias · cantidades por unidad</td><td class="num">'+
    money(rows.reduce((total,r)=>total+r.costTotal,0))+'</td><td colspan="3"></td></tr>';
  $('agePrev').disabled=agePage===0;$('ageNext').disabled=agePage>=pages-1;
}
function monthlyRows(){
  if(!state.meta)return [];
  const s=scope(),from=state.meta.movimientos_desde,to=state.meta.corte_inventario;
  const warehouse=$('rotWarehouse').value,selectedUnit=$('rotUnit').value;
  const stock=state.stock.filter(r=>M.matchScope(r,s)),moves=state.moves.filter(r=>M.matchScope(r,s));
  const monthFlow=new Map(M.monthlyConsumption(moves,from,to,warehouse,selectedUnit)
    .map(r=>[r.month,r.consumption]));
  const physical=stock.filter(r=>r.warehouse===warehouse&&r.unit===selectedUnit)
    .reduce((total,r)=>total+r.physical,0);
  return monthsInRange(from,to).map(month=>{
    const first=month+'-01',last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0))
      .toISOString().slice(0,10);
    const observedFrom=first<from?from:first,observedTo=last>to?to:last;
    return {month,period:observedFrom.slice(8)+'–'+observedTo.slice(8)+'/'+month.slice(5),
    partialMonth:observedFrom!==first||observedTo!==last,consumption:monthFlow.get(month)||0,
    cutoff:month===to.slice(0,7)?to:'—',
    partial:month===to.slice(0,7)&&physical>0?(monthFlow.get(month)||0)/physical:null,
    status:month===to.slice(0,7)?'Aproximación parcial':'Sin corte de inventario'};
  });
}
function renderRotation(){
  if(!state.meta)return;
  const s=scope(),from=state.meta.movimientos_desde,to=state.meta.corte_inventario;
  const warehouse=$('rotWarehouse').value,selectedUnit=$('rotUnit').value;
  const result=M.daysAndRotation(state.stock.filter(r=>M.matchScope(r,s)),
    state.moves.filter(r=>M.matchScope(r,s)),from,to,warehouse,selectedUnit);
  $('rotDays').textContent=result.daysOfInventory===null?'—':num(result.daysOfInventory)+' d';
  $('rotDaysSub').textContent=warehouse+' · '+selectedUnit+' · meta 45 días ±10 %';
  $('rotAnnual').textContent=result.annualizedRotation===null?'—':num(result.annualizedRotation)+'×';
  $('rotNet').textContent=num(result.consumption);$('rotNetSub').textContent=selectedUnit+' · '+result.periodDays+' días';
  $('rotDaily').textContent=result.periodDays?num(result.consumption/result.periodDays):'—';
  $('rotDailySub').textContent=selectedUnit+' / día · '+from+' a '+to;
  $('rotMonthly').textContent='—';
  $('monthlyCaption').textContent='CPN − DCN · '+M.WAREHOUSES[warehouse]+' · '+selectedUnit+' · * mes parcial según el rango exportado.';
  $('monthlyStatus').textContent='Este panel recibe el corte '+to+'. Para rotación mensual formal se necesitan inventarios de inicio y cierre de cada mes. El índice de '+to.slice(0,7)+' es parcial y usa el stock de ese corte como denominador.';
  table('monthlyRows',monthlyGrid.apply(monthlyRows()).map(r=>'<tr><td>'+esc(r.month)+
    '</td><td>'+esc(r.period)+'</td><td class="num">'+num(r.consumption)+' '+esc(selectedUnit)+'</td><td>'+esc(r.cutoff)+
    '</td><td class="num">'+(r.partial===null?'—':num(r.partial)+'×')+'</td><td><span class="status-badge '+
    (r.partial===null?'warn':'ok')+'">'+esc(r.status)+'</span></td></tr>').join(''),6);
  if(activePage()==='rotacion')renderCharts();
}
function render(){
  if(!state.meta)return;
  const s=scope(),u=unit(),stock=state.stock.filter(r=>M.matchScope(r,s));
  const {from:movementFrom,to:movementTo}=movementRange();
  const moves=M.movementRows(state.moves,s,movementFrom,movementTo),sum=M.stockSummary(stock);
  $('headerCut').textContent='Corte '+date(state.meta.corte_inventario);
  $('scopeCaption').textContent='Existencias al '+date(state.meta.corte_inventario)+' · EU y TEX separados por bodega.';
  $('value').textContent=money(sum.value);$('positions').textContent=num(sum.positions);
  $('physical').textContent=num(sum.quantity[u]);
  $('physicalSub').textContent=u+' · existencia física';
  $('committed').textContent=num(sum.committed[u])+' '+u;
  $('available').textContent=num(sum.available[u])+' '+u+' disponibles';
  const cut=state.meta.corte_inventario,from=state.meta.movimientos_desde;
  const cutMoves=state.moves.filter(r=>M.matchScope(r,s)&&r.date<=cut);
  for(const [warehouse,selectId,valueId,subId] of [
    ['MT001','fabricUnit','daysFabric','daysFabricSub'],['MT002','supplyUnit','daysSupply','daysSupplySub']]){
    const selected=$(selectId).value,indicator=M.daysAndRotation(stock,cutMoves,from,cut,warehouse,selected);
    $(valueId).textContent=indicator.daysOfInventory===null?'—':num(indicator.daysOfInventory)+' d';
    $(subId).textContent=warehouse+' · '+selected+' · '+
      (indicator.daysOfInventory===null?'sin consumo neto o existencia':'meta 45 días ±10 %');
  }
  const noCpn=M.consumptionAge(stock,cutMoves,from,cut)
    .filter(r=>r.consumptionCategory==='Sin CPN en 90 días');
  $('noConsumption90').textContent=num(noCpn.length);
  $('noConsumption90Sub').textContent=money(noCpn.reduce((total,r)=>total+r.costTotal,0))+' en existencias';
  $('obsolescence').textContent=state.age.length?money(state.age.filter(r=>M.matchScope(r,s))
    .reduce((total,r)=>total+r.riskValue,0)):'—';
  const agedFabric=state.age.filter(r=>M.matchScope(r,s)&&r.warehouse==='MT001'&&r.unit==='MT');
  $('obsolescenceMeters').textContent=state.age.length?
    'Telas +90: '+num(agedFabric.reduce((total,r)=>total+r.qty[3],0))+' MT · sin edad: '+
    num(agedFabric.reduce((total,r)=>total+r.qty[4],0))+' MT':'Metros de tela: —';
  $('obsolescenceSub').textContent=state.age.length?'Valor +90 días bajo FIFO · revisar edad no determinada':state.ageMessage;
  const groups=warehouseGroups(stock).map(g=>{const [company,warehouse]=g.label.split(' · '),x=g.summary;
    return {company,warehouse,positions:x.positions,value:x.value,physical:x.quantity[u]||0,
      committed:x.committed[u]||0,available:x.available[u]||0};});
  table('warehouses',warehouseGrid.apply(groups).map(g=>'<tr><td>'+esc(g.company)+'</td><td>'+esc(g.warehouse)+
    '</td><td class="num">'+num(g.positions)+'</td><td class="num">'+money(g.value)+
    '</td><td class="num">'+num(g.physical)+' '+esc(u)+'</td><td class="num">'+
    num(g.committed)+' '+esc(u)+'</td><td class="num">'+num(g.available)+' '+esc(u)+'</td></tr>').join(''));
  const ms=M.movementSummary(moves,u),codes=['CPN','EAC','DCN','RM','DCP','AIC','EIV','ENS'];
  const docRows=codes.filter(c=>ms.codes[c]).map(code=>({code,name:M.TYPES[code],...ms.codes[code]}));
  const shownDocs=docsGrid.apply(docRows);
  table('docs',shownDocs.map(d=>'<tr><td><button type="button" class="document-detail" data-doc="'+esc(d.code)+'" aria-label="Ver detalle de '+esc(d.name)+'"><span class="pill">'+esc(d.code)+'</span> '+esc(d.name)+'</button>'+
    '</td><td class="num">'+num(d.rows)+'</td><td class="num">'+num(d.inRows)+'</td><td class="num">'+num(d.outRows)+
    '</td><td class="num">'+num(d.inQty)+' '+esc(u)+'</td><td class="num">'+num(d.outQty)+' '+esc(u)+
    '</td><td class="num">'+money(d.inCost)+'</td><td class="num">'+money(d.outCost)+'</td></tr>').join(''),8);
  $('docsFooter').innerHTML='<tr><td>TOTAL FILTRADO</td>'+['rows','inRows','outRows'].map(key=>
    '<td class="num">'+num(shownDocs.reduce((sum,row)=>sum+row[key],0))+'</td>').join('')+
    ['inQty','outQty'].map(key=>'<td class="num">'+num(shownDocs.reduce((sum,row)=>sum+row[key],0))+' '+esc(u)+'</td>').join('')+
    ['inCost','outCost'].map(key=>'<td class="num">'+money(shownDocs.reduce((sum,row)=>sum+row[key],0))+'</td>').join('')+'</tr>';
  renderMonthlyMovements(moves,movementFrom,movementTo,u);
  $('movementCaption').textContent=num(ms.rows)+' movimientos visibles · '+movementFrom+' a '+movementTo+
    '. Conteo de filas con entradas o salidas, por documento.';
  const rank=(rows,sortId,limitId,quantity,value)=>{
    const order=$(sortId).value;
    rows.sort((a,b)=>order==='reference'?a.ref.localeCompare(b.ref)||a.company.localeCompare(b.company):
      order==='quantity'?quantity(b)-quantity(a)||a.ref.localeCompare(b.ref):
      value(b)-value(a)||a.ref.localeCompare(b.ref));
    return $(limitId).value==='all'?rows:rows.slice(0,Number($(limitId).value));
  };
  const prod=rank(productionGrid.apply(M.production(moves,u).filter(r=>r.net>0)),'productionSort','productionLimit',r=>r.net,r=>r.netCost);
  table('production',prod.map(r=>'<tr><td>'+esc(r.company)+' · '+esc(r.ref)+'</td><td>'+esc(r.name)+
    '</td><td class="num">'+num(r.net)+' '+esc(u)+'</td><td class="num">'+money(r.netCost)+'</td></tr>').join(''),4);
  $('productionFooter').innerHTML='<tr><td colspan="2">TOTAL MOSTRADO · '+num(prod.length)+' materiales</td><td class="num">'+
    num(prod.reduce((sum,r)=>sum+r.net,0))+' '+esc(u)+'</td><td class="num">'+
    money(prod.reduce((sum,r)=>sum+r.netCost,0))+'</td></tr>';
  const receipts=new Map();
  for(const r of moves){
    if(r.docType!=='EAC'||r.unit!==u)continue;
    const k=[r.company,r.warehouse,r.ref,r.unit].join('|');
    let a=receipts.get(k);if(!a){a={company:r.company,ref:r.ref,name:r.name,qty:0,value:0};receipts.set(k,a)}
    a.qty+=r.inQty;a.value+=r.inCost;
  }
  const top=rank(receiptsGrid.apply([...receipts.values()]),'receiptsSort','receiptsLimit',r=>r.qty,r=>r.value);
  table('receipts',top.map(r=>'<tr><td>'+esc(r.company)+' · '+esc(r.ref)+'</td><td>'+esc(r.name)+
    '</td><td class="num">'+num(r.qty)+' '+esc(u)+'</td><td class="num">'+money(r.value)+'</td></tr>').join(''),4);
  $('receiptsFooter').innerHTML='<tr><td colspan="2">TOTAL MOSTRADO · '+num(top.length)+' materiales</td><td class="num">'+
    num(top.reduce((sum,r)=>sum+r.qty,0))+' '+esc(u)+'</td><td class="num">'+
    money(top.reduce((sum,r)=>sum+r.value,0))+'</td></tr>';
  $('quality').textContent=num(sum.zeroCost)+' posiciones con existencia positiva y costo total cero en la selección. Revisar en SIESA.';
  renderMaterials();renderCoverage();renderStockAge();renderAge();renderRotation();renderCharts();
  window.PccLogisticsPurchases?.render();
}
async function sheet(sid,name,key,range='A:K'){
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sid)+'/values/'+
    encodeURIComponent(name+'!'+range)+'?key='+encodeURIComponent(key)+'&valueRenderOption=UNFORMATTED_VALUE&_='+Date.now();
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error('Sheets '+r.status+' · '+name);
  return (await r.json()).values||[];
}
function meta(grid){const m={};for(const r of grid.slice(1)){if(r.length>=2)m[str(r[0])]=str(r[1])}return m}
function parseStock(grid){
  if(grid[0]?.join('|')!=='empresa|bodega|referencia|descripcion|unidad|existencia|comprometida|disponible|costo_unitario|costo_total')
    throw Error('Esquema de existencias inesperado');
  return grid.slice(1).filter(r=>r[0]).map(r=>({company:str(r[0]),warehouse:str(r[1]),ref:str(r[2]),name:str(r[3]),
    unit:str(r[4]),physical:n(r[5]),committed:n(r[6]),available:n(r[7]),costUnit:n(r[8]),costTotal:n(r[9])}));
}
function parseMoves(grid){
  if(grid[0]?.join('|')!=='empresa|bodega|referencia|descripcion|unidad|fecha|tipo_documento|entrada|salida|costo_entrada|costo_salida')
    throw Error('Esquema de movimientos inesperado');
  return grid.slice(1).filter(r=>r[0]).map(r=>({company:str(r[0]),warehouse:str(r[1]),ref:str(r[2]),name:str(r[3]),
    unit:str(r[4]),date:str(r[5]),docType:str(r[6]),inQty:n(r[7]),outQty:n(r[8]),inCost:n(r[9]),outCost:n(r[10])}));
}
function parseStockAge(grid){
  const header=['empresa','bodega','referencia','descripcion','unidad','existencia','valor',
    'q_0_30','q_31_60','q_61_90','q_mas_90','q_indeterminada',
    'v_0_30','v_31_60','v_61_90','v_mas_90','v_indeterminada','estado_fifo'];
  if(grid[0]?.join('|')!==header.join('|'))throw Error('Esquema de edad inesperado');
  return grid.slice(1).filter(r=>r[0]).map(r=>{
    const qty=r.slice(7,12).map(n),values=r.slice(12,17).map(n),physical=n(r[5]),value=n(r[6]);
    if(Math.abs(qty.reduce((a,b)=>a+b,0)-physical)>0.0001||
       Math.abs(values.reduce((a,b)=>a+b,0)-value)>0.03)throw Error('Edad no concilia para '+str(r[0])+' '+str(r[2]));
    return {company:str(r[0]),warehouse:str(r[1]),ref:str(r[2]),name:str(r[3]),unit:str(r[4]),
      physical,value,qty,values,riskValue:values[3],status:str(r[17])};
  });
}
async function readStockAge(sid,key,current){
  try{
    const before=meta(await sheet(sid,'LOG_Edad_Control',key,'A:B'));
    if(before.estado!=='LISTO'||before.version_fuente!==current.version||
       before.carga_id!==current.carga_id||before.corte_inventario!==current.corte_inventario)
      throw Error('La edad FIFO de este corte aún no está publicada');
    const rows=parseStockAge(await sheet(sid,'LOG_Edad',key,'A:R'));
    const after=meta(await sheet(sid,'LOG_Edad_Control',key,'A:B'));
    if(after.estado!=='LISTO'||after.version_fuente!==before.version_fuente||
       rows.length!==Number(after.filas))throw Error('La edad cambió durante la lectura');
    return {rows,message:''};
  }catch(error){return {rows:[],message:error.message}}
}
async function refresh(){
  try{
    if(location.protocol==='file:'){
      status('Abra Logística desde el CMI mediante un servidor local (http://127.0.0.1:4174/#log). Chrome bloquea la carga de datos desde file://.','error');
      return;
    }
    const cfg=await(await fetch('config.json',{cache:'no-store'})).json(),sid=cfg.logistica?.sheetId;
    if(!sid){status('Conexión pendiente: falta indicar la hoja de Google Sheets para Logística.','warn');return}
    const key=parent.PccLogisticsApiKey?.();
    if(!key)throw Error('Abra Logística desde la pestaña del CMI (index.html#log)');
    status('Consultando Google Sheets…','loading');
    const before=meta(await sheet(sid,'LOG_Control',key));
    if(before.estado!=='LISTO')throw Error('La carga de datos está en proceso o requiere revisión');
    const [rawStock,rawMoves]=await Promise.all([sheet(sid,'LOG_Existencias',key),sheet(sid,'LOG_Movimientos',key)]);
    const after=meta(await sheet(sid,'LOG_Control',key));
    if(after.estado!=='LISTO'||before.version!==after.version)throw Error('La hoja cambió durante la lectura; actualice de nuevo');
    const stock=parseStock(rawStock),moves=parseMoves(rawMoves);
    if(stock.length!==Number(after.filas_existencias)||moves.length!==Number(after.filas_movimientos))
      throw Error('Conteo de filas no concilia con LOG_Control');
    const aging=await readStockAge(sid,key,after);
    state.stock=stock;state.moves=moves;state.age=aging.rows;state.ageMessage=aging.message;
    state.meta=after;syncMovementRange();fillUnits();fillWarehouseUnits();fillRotationUnits();render();
    status('Inventario: '+date(after.corte_inventario)+' · Movimientos: '+date(after.movimientos_desde)+' a '+
      date(after.movimientos_hasta)+' · '+num(stock.length)+' posiciones y '+num(moves.length)+' movimientos.');
    await window.PccLogisticsPurchases?.load((name,range)=>sheet(sid,name,key,range),stock,moves,after);
  }catch(e){
    if(state.meta)status('No se pudo actualizar: '+e.message+'. Siguen visibles las cifras del corte '+state.meta.corte_inventario+'.','stale');
    else if(/LOG_Control/.test(e.message))status('La hoja de Logística aún no tiene un corte publicado.','warn');
    else status('Logística sin datos publicados: '+e.message,'error');
    console.error('[Logística]',e);
  }
}
function exportMaterials(){
  if(!state.meta)return;
  const rows=materialRows(),head=['Corte','Empresa','Bodega','Referencia','Material','Unidad','Físico','Comprometido','Disponible','Valor según SIESA ($)'];
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv='\uFEFF'+[head,...rows.map(r=>[state.meta.corte_inventario,r.company,r.warehouse,r.ref,r.name,r.unit,r.physical,r.committed,r.available,r.costTotal])]
    .map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='Logistica_materiales_'+state.meta.corte_inventario+'.csv';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportRows(filename,head,rows){
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  const csv='\uFEFF'+[head,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportCoverage(){
  if(!state.meta)return;
  exportRows('Logistica_cobertura_'+state.meta.corte_inventario+'.csv',
    ['Corte','Empresa','Bodega','Referencia','Material','Unidad','Físico','Consumo neto','Días estimados','Categoría','Valor ($)'],
    coverageRows().map(r=>[state.meta.corte_inventario,r.company,r.warehouse,r.ref,r.name,r.unit,
      r.physical,r.consumption,r.coverageDays??'',r.coverageCategory,r.costTotal]));
}
function exportAge(){
  if(!state.meta)return;
  exportRows('Logistica_sin_consumo_'+state.meta.corte_inventario+'.csv',
    ['Corte','Empresa','Bodega','Referencia','Material','Unidad','Físico','Valor ($)','Último CPN observado','Días desde CPN','Tramo'],
    ageRows().map(r=>[state.meta.corte_inventario,r.company,r.warehouse,r.ref,r.name,r.unit,
      r.physical,r.costTotal,r.lastConsumption||'',r.daysSinceConsumption??'',r.consumptionCategory]));
}
function exportStockAge(){
  if(!state.meta||!state.age.length)return;
  exportRows('Logistica_edad_FIFO_'+state.meta.corte_inventario+'.csv',
    ['Corte','Empresa','Bodega','Referencia','Material','Unidad','Físico','Valor ($)',
      '0–30','31–60','61–90','+90','Edad no determinada','Valor +90 ($)','Estado'],
    stockAgeRows().map(r=>[state.meta.corte_inventario,r.company,r.warehouse,r.ref,r.name,r.unit,
      r.physical,r.value,...r.qty,r.riskValue,r.status]));
}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
for(const id of ['company','type','warehouse','unit'])$(id).addEventListener('change',()=>{
  materialPage=0;coveragePage=0;agePage=0;stockAgePage=0;
  if(id==='company')fillWarehouseUnits();
  if(id==='company')window.PccLogisticsPurchases?.filterOptions();
  if(['company','type','warehouse'].includes(id))fillRotationUnits();
  render();
});
for(const id of ['movementFrom','movementTo'])$(id).addEventListener('change',()=>{
  if(!state.meta)return;
  const control=$(id),min=state.meta.movimientos_desde,max=state.meta.movimientos_hasta;
  if(!control.value||control.value<min)control.value=min;
  if(control.value>max)control.value=max;
  if($('movementFrom').value>$('movementTo').value){
    if(id==='movementFrom')$('movementTo').value=$('movementFrom').value;
    else $('movementFrom').value=$('movementTo').value;
  }
  render();
});
$('movementAll').addEventListener('click',()=>{
  if(!state.meta)return;
  $('movementFrom').value=state.meta.movimientos_desde;
  $('movementTo').value=state.meta.movimientos_hasta;
  render();
});
for(const id of ['fabricUnit','supplyUnit'])$(id).addEventListener('change',render);
for(const id of ['rotWarehouse','rotUnit'])$(id).addEventListener('change',()=>{
  if(id==='rotWarehouse')fillRotationUnits(true);renderRotation();
});
for(const id of ['productionLimit','productionSort','receiptsLimit','receiptsSort'])$(id).addEventListener('change',render);
for(const [id,mode] of [['docsModeRows','rows'],['docsModeQuantity','quantity']])$(id).addEventListener('click',()=>{
  docsMode=mode;
  for(const [buttonId,buttonMode] of [['docsModeRows','rows'],['docsModeQuantity','quantity']]){
    $(buttonId).classList.toggle('active',buttonMode===mode);
    $(buttonId).setAttribute('aria-pressed',String(buttonMode===mode));
  }
  renderCharts();
});
for(const [id,mode] of [['monthlyModeQuantity','quantity'],['monthlyModeValue','value']])$(id).addEventListener('click',()=>{
  monthlyMode=mode;
  for(const [buttonId,buttonMode] of [['monthlyModeQuantity','quantity'],['monthlyModeValue','value']]){
    $(buttonId).classList.toggle('active',buttonMode===mode);
    $(buttonId).setAttribute('aria-pressed',String(buttonMode===mode));
  }
  if(state.meta)render();
});
$('docs').addEventListener('click',event=>{
  const button=event.target.closest('button[data-doc]');
  if(button)openMovementDetail(button.dataset.doc);
});
$('movementDetailClose').addEventListener('click',()=>$('movementDetail').close());
$('movementDetailMore').addEventListener('click',()=>{detailLimit+=100;renderMovementDetail()});
$('movementDetail').addEventListener('click',event=>{
  if(event.target===$('movementDetail'))$('movementDetail').close();
});
$('coverageSearch').addEventListener('input',()=>{coveragePage=0;renderCoverage()});
$('coverageCategory').addEventListener('change',()=>{coveragePage=0;renderCoverage()});
$('coveragePrev').addEventListener('click',()=>{coveragePage--;renderCoverage()});
$('coverageNext').addEventListener('click',()=>{coveragePage++;renderCoverage()});
$('coverageCsv').addEventListener('click',exportCoverage);
$('ageSearch').addEventListener('input',()=>{agePage=0;renderAge()});
$('ageCategory').addEventListener('change',()=>{agePage=0;renderAge()});
$('agePrev').addEventListener('click',()=>{agePage--;renderAge()});
$('ageNext').addEventListener('click',()=>{agePage++;renderAge()});
$('ageCsv').addEventListener('click',exportAge);
$('stockAgeSearch').addEventListener('input',()=>{stockAgePage=0;renderStockAge()});
$('stockAgeCategory').addEventListener('change',()=>{stockAgePage=0;renderStockAge()});
$('stockAgePrev').addEventListener('click',()=>{stockAgePage--;renderStockAge()});
$('stockAgeNext').addEventListener('click',()=>{stockAgePage++;renderStockAge()});
$('stockAgeCsv').addEventListener('click',exportStockAge);
$('materialSearch').addEventListener('input',()=>{materialPage=0;renderMaterials()});
$('materialPrev').addEventListener('click',()=>{materialPage--;renderMaterials()});
$('materialNext').addEventListener('click',()=>{materialPage++;renderMaterials()});
$('materialCsv').addEventListener('click',exportMaterials);
$('refreshBtn').addEventListener('click',refresh);
$('clearFilters').addEventListener('click',()=>{
  $('company').value='all';$('type').value='all';$('warehouse').value='all';
  if(state.meta){$('movementFrom').value=state.meta.movimientos_desde;$('movementTo').value=state.meta.movimientos_hasta;}
  materialPage=0;coveragePage=0;agePage=0;stockAgePage=0;fillWarehouseUnits();fillRotationUnits();render();
});
window.refresh=refresh;refresh();
})();
