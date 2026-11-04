(()=>{'use strict';
const M=window.PccLogisticsModel,$=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1});
const num=value=>fmt.format(Number(value)||0),money=value=>'$ '+num(value);
const moneyCompact=value=>'$ '+compact.format(Number(value)||0);
const pct=value=>fmt.format(value)+' %';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={data:null,index:null,charts:{},request:0};
function company(){return $('company').value}
function selected(row){return company()==='all'||row.company===company()}
function draw(id,config){
  if(state.charts[id]){state.charts[id].destroy();delete state.charts[id]}
  const canvas=$(id);
  if(typeof Chart==='undefined'){
    canvas.hidden=true;return;
  }
  canvas.hidden=false;
  state.charts[id]=new Chart(canvas,config);
}
function gradient(ctx,top,bottom){
  const area=ctx.chart.chartArea;
  if(!area)return top;
  const fill=ctx.chart.ctx.createLinearGradient(0,area.top,0,area.bottom);
  fill.addColorStop(0,top);fill.addColorStop(1,bottom);
  return fill;
}
function chartOptions(asValue=true){
  return {responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{top:24,right:12}},
    plugins:{legend:{position:'top',labels:{color:'#52677C',font:{family:'DM Sans',size:10,weight:600},boxWidth:10,usePointStyle:true,pointStyle:'rectRounded'}},
      tooltip:{backgroundColor:'#183654',padding:10,callbacks:{label:c=>c.dataset.label+': '+(asValue?money(c.parsed.y):num(c.parsed.y))}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'end',offset:c=>c.datasetIndex===1?17:3,
        color:'#183654',clip:false,font:{family:'DM Sans',size:10,weight:700},
        formatter:v=>asValue?moneyCompact(v):compact.format(v)}},
    scales:{x:{ticks:{color:'#64778B',font:{family:'DM Sans',size:10}},grid:{display:false},border:{display:false}},
      y:{beginAtZero:true,grace:'24%',ticks:{color:'#8292A2',font:{family:'DM Sans',size:9},callback:v=>asValue?moneyCompact(v):compact.format(v)},
        grid:{color:'#E4ECF3'},border:{display:false}}}};
}
function renderCurrentAge(){
  if(!state.data)return;
  for(const [warehouse,valueId,noteId,cardId] of [
    ['MT001','agedFabricValue','agedFabricNote','agedFabricCard'],
    ['MT002','agedSupplyValue','agedSupplyNote','agedSupplyCard']]){
    const rows=state.data.age.filter(r=>selected(r)&&r.warehouse===warehouse);
    $(valueId).textContent=state.data.age.length?money(rows.reduce((sum,r)=>sum+r.riskValue,0)):'—';
    $(noteId).textContent=state.data.age.length?
      num(rows.filter(r=>r.riskValue>0).length)+' referencias +90 · ver detalle':
      state.data.ageMessage;
  }
}
function renderFlow(){
  if(!state.data||document.body.dataset.area!=='general')return;
  const {moves,meta}=state.data,from=meta.movimientos_desde,to=meta.movimientos_hasta;
  const source=moves.filter(selected);
  const fabric=M.monthlyMovements(source.filter(r=>r.warehouse==='MT001'),from,to);
  const supply=M.monthlyMovements(source.filter(r=>r.warehouse==='MT002'),from,to);
  $('overviewFlowNote').textContent='Costos de todas las transacciones del informe vigente · '+from+' a '+to+
    '. Los meses incompletos se marcan con *.';
  for(const [warehouse,rows,prefix,colors] of [
    ['MT001',fabric,'Fabric',['#0D6B5E','#1B3A5C']],
    ['MT002',supply,'Supply',['#36A38E','#4E6F98']]]){
    $('overview'+prefix+'FlowRows').innerHTML=rows.map(r=>'<tr><td>'+esc(r.month)+(r.partial?' *':'')+
      '</td><td>'+esc(r.from)+' a '+esc(r.to)+'</td><td class="num">'+money(r.inCost)+
      '</td><td class="num">'+money(r.outCost)+'</td></tr>').join('');
    draw('overview'+prefix+'FlowChart',{type:'bar',data:{labels:rows.map(r=>r.month+(r.partial?' *':'')),datasets:[
      {label:'Entradas · $',data:rows.map(r=>r.inCost),backgroundColor:c=>gradient(c,colors[0],warehouse==='MT001'?'#39A995':'#81C9B9'),borderRadius:6,maxBarThickness:34},
      {label:'Salidas · $',data:rows.map(r=>r.outCost),backgroundColor:c=>gradient(c,colors[1],warehouse==='MT001'?'#547396':'#829DC0'),borderRadius:6,maxBarThickness:34}
    ]},options:chartOptions()});
  }
}
function monthCuts(){
  const byMonth=new Map();
  for(const cut of state.index?.cuts||[]){
    const month=cut.cutoff.slice(0,7),prior=byMonth.get(month);
    if(!prior||cut.cutoff>prior.cutoff)byMonth.set(month,cut);
  }
  return [...byMonth.values()].sort((a,b)=>a.cutoff.localeCompare(b.cutoff));
}
function monthEnd(date){
  const d=new Date(date+'T00:00:00Z');
  return d.getUTCDate()===new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
}
function grouped(cut,warehouse,unit){
  return cut.summary.filter(r=>selected(r)&&r.warehouse===warehouse&&(!unit||r.unit===unit));
}
function sum(rows,key){return rows.reduce((total,r)=>total+Number(r[key]||0),0)}
function ageGroups(cut){
  if(Array.isArray(cut.age))return cut.age;
  if(cut.cutoff!==state.data?.meta.corte_inventario||!state.data.age.length)return null;
  return ['EU','TEX'].flatMap(company=>['MT001','MT002'].map(warehouse=>({
    company,warehouse,value90:sum(state.data.age.filter(r=>r.company===company&&r.warehouse===warehouse),'riskValue'),
    valueUnknown:state.data.age.filter(r=>r.company===company&&r.warehouse===warehouse)
      .reduce((total,r)=>total+Number(r.values[4]||0),0)
  })));
}
function fillMetricOptions(cuts,warehouse,prefix){
  const select=$('overview'+prefix+'Metric'),previous=select.value;
  const options=[new Option('Valor de inventario · $','value')];
  const units=[...new Set(cuts.flatMap(c=>c.summary.filter(r=>r.warehouse===warehouse).map(r=>r.unit)))].sort();
  for(const unit of units)options.push(new Option('Cantidad · '+unit,unit));
  select.replaceChildren(...options);
  select.value=[...select.options].some(o=>o.value===previous)?previous:'value';
}
function renderHistory(){
  if(!state.index||!state.data||document.body.dataset.area!=='general')return;
  const cuts=monthCuts();
  const labels=cuts.map(c=>c.cutoff.slice(0,7)+(monthEnd(c.cutoff)?'':' *'));
  for(const [warehouse,prefix,colors] of [
    ['MT001','Fabric',['#0D6B5E','#44B2A0']],
    ['MT002','Supply',['#1B3A5C','#6C91BC']]]){
    fillMetricOptions(cuts,warehouse,prefix);
    const metric=$('overview'+prefix+'Metric').value,asValue=metric==='value';
    const values=cuts.map(c=>sum(grouped(c,warehouse,asValue?null:metric),asValue?'value':'physical'));
    $('overview'+prefix+'HistoryHead').textContent=asValue?'Valor · $':'Cantidad · '+metric;
    $('overview'+prefix+'HistoryRows').innerHTML=cuts.map((c,i)=>'<tr><td>'+esc(c.cutoff.slice(0,7))+
      '</td><td>'+esc(c.cutoff)+'</td><td>'+(monthEnd(c.cutoff)?'Último día del mes':'Último corte disponible')+
      '</td><td class="num">'+(asValue?money(values[i]):num(values[i])+' '+esc(metric))+'</td></tr>').join('');
    draw('overview'+prefix+'HistoryChart',{type:'bar',data:{labels,datasets:[{
      label:asValue?'Valor de inventario · $':'Existencia física · '+metric,data:values,
      backgroundColor:c=>gradient(c,colors[0],colors[1]),borderRadius:7,maxBarThickness:68
    }]},options:{...chartOptions(asValue),plugins:{...chartOptions(asValue).plugins,legend:{display:false}}}});
  }
  $('overviewHistoryNote').textContent='* último corte disponible del mes; no equivale a cierre. '+
    'El valor corresponde a la fecha exacta indicada en la tabla.';
  $('overviewAgeRows').innerHTML=cuts.map(c=>{
    const age=ageGroups(c),group=warehouse=>age?.filter(r=>selected(r)&&r.warehouse===warehouse)||[];
    const f=group('MT001'),s=group('MT002');
    const fv=sum(f,'value90'),sv=sum(s,'value90');
    const fstock=sum(grouped(c,'MT001'),'value'),sstock=sum(grouped(c,'MT002'),'value');
    const unknown=age?sum(f.concat(s),'valueUnknown'):null;
    return '<tr><td>'+esc(c.cutoff.slice(0,7))+' · '+esc(c.cutoff)+'</td>'+
      '<td class="num">'+(age?money(fv):'—')+'</td><td class="num">'+(age&&fstock?pct(100*fv/fstock):'—')+
      '</td><td class="num">'+(age?money(sv):'—')+'</td><td class="num">'+
      (age&&sstock?pct(100*sv/sstock):'—')+'</td><td>'+
      (age?'Sin edad determinada: '+money(unknown):'Edad histórica pendiente de publicación')+'</td></tr>';
  }).join('');
  $('overviewHistoryStatus').textContent=cuts.length+' mes(es) con corte real conservado. '+
    (cuts.some(c=>!ageGroups(c))?'La edad de algunos cortes está pendiente de publicación.':'Edad FIFO disponible por corte.');
  $('overviewHistoryStatus').className='banner'+(cuts.some(c=>!ageGroups(c))?' warn':'');
}
function openAge(warehouse){
  if(!state.data)return;
  const rows=state.data.age.filter(r=>selected(r)&&r.warehouse===warehouse&&
    (r.riskValue>0||Number(r.values[4])>0)).sort((a,b)=>b.riskValue-a.riskValue);
  $('overviewAgeDetailTitle').textContent=(warehouse==='MT001'?'Telas':'Insumos')+' · saldo estimado +90 días';
  $('overviewAgeDetailNote').textContent=state.data.age.length?'Corte '+state.data.meta.corte_inventario+
    ' · valor estimado por FIFO. La edad indeterminada se presenta aparte y no se cuenta como +90.':
    'El detalle FIFO del corte '+state.data.meta.corte_inventario+' aún no está disponible: '+state.data.ageMessage;
  $('overviewAgeDetailRows').innerHTML=rows.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.qty[3])+
    '</td><td class="num">'+money(r.riskValue)+'</td><td class="num">'+money(r.values[4])+
    '</td><td>'+esc(r.status)+'</td></tr>').join('')||
    '<tr><td colspan="8" class="empty">Sin referencias +90 ni edad indeterminada en esta selección.</td></tr>';
  $('overviewAgeDetailTotal').innerHTML='<tr><td colspan="4">TOTAL · valores en pesos; cantidades separadas por unidad</td>'+ 
    '<td class="num">—</td><td class="num">'+money(sum(rows,'riskValue'))+'</td><td class="num">'+
    money(rows.reduce((total,r)=>total+Number(r.values[4]||0),0))+'</td><td></td></tr>';
  $('overviewAgeDetailCount').textContent=num(rows.length)+' referencias · empresa '+
    (company()==='all'?'EU + TEX':company());
  $('overviewAgeDetail').showModal();
}
async function loadHistory(){
  const token=++state.request;
  $('overviewHistoryStatus').textContent='Consultando cortes conservados…';
  $('overviewHistoryStatus').className='banner loading';
  try{
    const index=await window.PccLogisticsHistory.readIndex(true);
    if(token!==state.request)return;
    state.index=index;renderHistory();
  }catch(error){
    if(token!==state.request)return;
    state.index=null;$('overviewFabricHistoryRows').replaceChildren();$('overviewSupplyHistoryRows').replaceChildren();$('overviewAgeRows').replaceChildren();
    for(const id of ['overviewFabricHistoryChart','overviewSupplyHistoryChart']){
      if(state.charts[id]){state.charts[id].destroy();delete state.charts[id]}
    }
    $('overviewHistoryStatus').textContent='Histórico no disponible: '+(error.message||String(error));
    $('overviewHistoryStatus').className='banner warn';
  }
}
function render(data){state.data=data;renderCurrentAge();renderFlow();renderHistory()}
$('overviewFabricMetric').addEventListener('change',renderHistory);
$('overviewSupplyMetric').addEventListener('change',renderHistory);
$('agedFabricCard').addEventListener('click',()=>openAge('MT001'));
$('agedSupplyCard').addEventListener('click',()=>openAge('MT002'));
$('overviewAgeDetailClose').addEventListener('click',()=>$('overviewAgeDetail').close());
$('overviewAgeDetail').addEventListener('click',event=>{
  if(event.target===$('overviewAgeDetail'))$('overviewAgeDetail').close();
});
window.PccLogisticsOverview={render,loadHistory};
})();
