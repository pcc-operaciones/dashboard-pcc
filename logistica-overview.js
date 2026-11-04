(()=>{'use strict';
const M=window.PccLogisticsModel,$=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1});
const num=value=>fmt.format(Number(value)||0),money=value=>'$ '+num(value);
const moneyCompact=value=>'$ '+compact.format(Number(value)||0);
const pct=value=>fmt.format(value)+' %';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={data:null,index:null,flowChart:null,historyChart:null,request:0};
function company(){return $('company').value}
function selected(row){return company()==='all'||row.company===company()}
function draw(id,kind,config){
  if(state[kind]){state[kind].destroy();state[kind]=null}
  const canvas=$(id);
  if(typeof Chart==='undefined'){
    canvas.hidden=true;return;
  }
  canvas.hidden=false;
  state[kind]=new Chart(canvas,config);
}
function renderCurrentAge(){
  if(!state.data)return;
  for(const [warehouse,valueId,noteId,cardId] of [
    ['MT001','agedFabricValue','agedFabricNote','agedFabricCard'],
    ['MT002','agedSupplyValue','agedSupplyNote','agedSupplyCard']]){
    const rows=state.data.age.filter(r=>selected(r)&&r.warehouse===warehouse);
    $(cardId).disabled=!state.data.age.length;
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
  $('overviewFlowRows').innerHTML=fabric.map((r,i)=>'<tr><td>'+esc(r.month)+(r.partial?' *':'')+
    '</td><td>'+esc(r.from)+' a '+esc(r.to)+'</td><td class="num">'+money(r.inCost)+
    '</td><td class="num">'+money(r.outCost)+'</td><td class="num">'+money(supply[i].inCost)+
    '</td><td class="num">'+money(supply[i].outCost)+'</td></tr>').join('');
  draw('overviewFlowChart','flowChart',{type:'bar',data:{labels:fabric.map(r=>r.month+(r.partial?' *':'')),datasets:[
    {label:'Telas · entradas',data:fabric.map(r=>r.inCost),backgroundColor:'#0D6B5E',borderRadius:3},
    {label:'Telas · salidas',data:fabric.map(r=>r.outCost),backgroundColor:'#1B3A5C',borderRadius:3},
    {label:'Insumos · entradas',data:supply.map(r=>r.inCost),backgroundColor:'#36A38E',borderRadius:3},
    {label:'Insumos · salidas',data:supply.map(r=>r.outCost),backgroundColor:'#4E6F98',borderRadius:3}
  ]},options:{responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{labels:{font:{family:'DM Sans',size:10},boxWidth:11}},
      tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.parsed.y)}},
      datalabels:{display:false}},
    scales:{x:{ticks:{font:{family:'DM Sans',size:10}},grid:{display:false}},
      y:{beginAtZero:true,ticks:{callback:v=>moneyCompact(v)},grid:{color:'#E2E8F0'}}}}});
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
function fillMetricOptions(cuts){
  const select=$('overviewHistoryMetric'),previous=select.value;
  const options=[new Option('Valor de inventario · $','value')];
  for(const [warehouse,name] of [['MT001','Telas'],['MT002','Insumos']]){
    const units=[...new Set(cuts.flatMap(c=>c.summary.filter(r=>r.warehouse===warehouse).map(r=>r.unit)))].sort();
    for(const unit of units)options.push(new Option(name+' · '+unit,warehouse+':'+unit));
  }
  select.replaceChildren(...options);
  select.value=[...select.options].some(o=>o.value===previous)?previous:'value';
}
function renderHistory(){
  if(!state.index||!state.data||document.body.dataset.area!=='general')return;
  const cuts=monthCuts();fillMetricOptions(cuts);
  const metric=$('overviewHistoryMetric').value,asValue=metric==='value';
  const labels=cuts.map(c=>c.cutoff.slice(0,7)+(monthEnd(c.cutoff)?'':' *'));
  const datasets=asValue?[
    {label:'Telas · $',warehouse:'MT001',color:'#0D6B5E'},
    {label:'Insumos · $',warehouse:'MT002',color:'#1B3A5C'}
  ]: [{label:metric.startsWith('MT001')?'Telas · '+metric.split(':')[1]:'Insumos · '+metric.split(':')[1],
    warehouse:metric.split(':')[0],unit:metric.split(':')[1],color:'#0D6B5E'}];
  draw('overviewHistoryChart','historyChart',{type:'bar',data:{labels,datasets:datasets.map(d=>({
    label:d.label,data:cuts.map(c=>sum(grouped(c,d.warehouse,d.unit),asValue?'value':'physical')),
    backgroundColor:d.color,borderRadius:4
  }))},options:{responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{labels:{font:{family:'DM Sans',size:10},boxWidth:11}},
      tooltip:{callbacks:{label:c=>c.dataset.label+': '+(asValue?money(c.parsed.y):num(c.parsed.y))}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,anchor:'end',align:'end',
        color:'#1B3A5C',clip:true,font:{family:'DM Sans',size:9,weight:700},
        formatter:v=>asValue?moneyCompact(v):compact.format(v)}},
    layout:{padding:{top:18,right:15}},
    scales:{x:{ticks:{font:{family:'DM Sans',size:10}},grid:{display:false}},
      y:{beginAtZero:true,grace:'18%',ticks:{callback:v=>asValue?moneyCompact(v):num(v)},grid:{color:'#E2E8F0'}}}}});
  $('overviewHistoryNote').textContent='* último corte disponible del mes; no equivale a cierre. '+
    'El valor corresponde a la fecha exacta indicada en la tabla.';
  $('overviewHistoryRows').innerHTML=cuts.map(c=>'<tr><td>'+esc(c.cutoff.slice(0,7))+
    '</td><td>'+esc(c.cutoff)+'</td><td>'+(monthEnd(c.cutoff)?'Último día del mes':'Último corte disponible')+
    '</td><td class="num">'+money(sum(grouped(c,'MT001'),'value'))+
    '</td><td class="num">'+money(sum(grouped(c,'MT002'),'value'))+'</td></tr>').join('');
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
  if(!state.data?.age.length)return;
  const rows=state.data.age.filter(r=>selected(r)&&r.warehouse===warehouse&&
    (r.riskValue>0||Number(r.values[4])>0)).sort((a,b)=>b.riskValue-a.riskValue);
  $('overviewAgeDetailTitle').textContent=(warehouse==='MT001'?'Telas':'Insumos')+' · saldo estimado +90 días';
  $('overviewAgeDetailNote').textContent='Corte '+state.data.meta.corte_inventario+
    ' · valor estimado por FIFO. La edad indeterminada se presenta aparte y no se cuenta como +90.';
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
    state.index=null;$('overviewHistoryRows').replaceChildren();$('overviewAgeRows').replaceChildren();
    if(state.historyChart){state.historyChart.destroy();state.historyChart=null}
    $('overviewHistoryStatus').textContent='Histórico no disponible: '+(error.message||String(error));
    $('overviewHistoryStatus').className='banner warn';
  }
}
function render(data){state.data=data;renderCurrentAge();renderFlow();renderHistory()}
$('overviewHistoryMetric').addEventListener('change',renderHistory);
$('agedFabricCard').addEventListener('click',()=>openAge('MT001'));
$('agedSupplyCard').addEventListener('click',()=>openAge('MT002'));
$('overviewAgeDetailClose').addEventListener('click',()=>$('overviewAgeDetail').close());
$('overviewAgeDetail').addEventListener('click',event=>{
  if(event.target===$('overviewAgeDetail'))$('overviewAgeDetail').close();
});
window.PccLogisticsOverview={render,loadHistory};
})();
