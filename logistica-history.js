(()=>{'use strict';
const M=window.PccLogisticsModel,$=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
const num=value=>fmt.format(Number(value)||0);
const money=value=>'$ '+num(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={index:null,detail:null,chart:null,page:0,request:0};
let indexPromise=null;
const pageSize=100;
const col=(label,key,type='text')=>({label,type,get:r=>r[key]});
const histGrid=window.PccLogisticsGrid.create('histTable',[
  col('Empresa','company','enum'),col('Bodega','warehouse','enum'),col('Referencia','ref'),
  col('Material','name'),col('U. M.','unit','enum'),col('Físico','physical','number'),
  col('Comprometido','committed','number'),col('Disponible','available','number'),
  col('Valor','costTotal','number')],()=>{state.page=0;renderRows()});
function scope(){return {company:$('company').value,type:$('type').value,warehouse:$('warehouse').value}}
function selectedUnit(){return $('unit').value}
function cut(){return state.index?.cuts.find(c=>c.id===$('histCut').value)}
function message(text,kind=''){const el=$('histMessage');el.textContent=text;el.className='banner'+(kind?' '+kind:'')}
async function values(sid,key,name,range){
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(sid)+'/values/'+
    encodeURIComponent(name+'!'+range)+'?key='+encodeURIComponent(key)+
    '&valueRenderOption=UNFORMATTED_VALUE&_='+Date.now();
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('No se pudo leer '+name+' (Sheets '+response.status+').');
  return (await response.json()).values||[];
}
async function payload(sid,key,descriptor){
  if(!descriptor||!Number.isInteger(descriptor.row)||!Number.isInteger(descriptor.count)||
     descriptor.row<2||descriptor.count<1||!/^([0-9a-f]{64})$/.test(descriptor.hash))
    throw Error('Índice histórico inválido.');
  const rows=await values(sid,key,'LOG_Hist_Datos','A'+descriptor.row+':A'+(descriptor.row+descriptor.count-1));
  if(rows.length!==descriptor.count||rows.some(r=>typeof r[0]!=='string'||!r[0].startsWith('j')))
    throw Error('Faltan fragmentos de la consulta histórica.');
  const text=rows.map(r=>r[0].slice(1)).join('');
  if(!crypto.subtle)throw Error('El navegador no puede verificar la integridad del histórico.');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==descriptor.hash)throw Error('La consulta histórica no superó la verificación de integridad.');
  return JSON.parse(text);
}
async function connection(){
  const cfg=await(await fetch('config.json',{cache:'no-store'})).json();
  const sid=cfg.logistica?.sheetId,key=parent.PccLogisticsApiKey?.();
  if(!sid||!key)throw Error('Falta la conexión de Logística con Google Sheets.');
  return {sid,key};
}
function chooseOptions(){
  const cuts=state.index.cuts.slice().sort((a,b)=>b.cutoff.localeCompare(a.cutoff));
  $('histCut').replaceChildren(...cuts.map(c=>new Option(c.cutoff.split('-').reverse().join('/'),c.id)));
  updateComparisons();
  $('histIntro').textContent='Cortes conservados desde '+cuts[cuts.length-1].cutoff+
    '. Solo aparecen fechas declaradas y respaldadas.';
}
function updateComparisons(){
  const current=cut(),prior=$('histCompare').value;
  const earlier=state.index.cuts.filter(c=>c.cutoff<current.cutoff)
    .sort((a,b)=>b.cutoff.localeCompare(a.cutoff));
  $('histCompare').replaceChildren(new Option('Sin comparación',''),
    ...earlier.map(c=>new Option(c.cutoff.split('-').reverse().join('/'),c.id)));
  $('histCompare').value=earlier.some(c=>c.id===prior)?prior:(earlier[0]?.id||'');
}
function totals(c){
  const s=scope(),unit=selectedUnit();
  const groups=c.summary.filter(r=>M.matchScope(r,s));
  return groups.reduce((a,r)=>{
    a.positions+=Number(r.positions);a.value+=Number(r.value);
    if(r.unit===unit){
      a.physical+=Number(r.physical);a.committed+=Number(r.committed);
      a.available+=Number(r.available);
    }
    return a;
  },{positions:0,value:0,physical:0,committed:0,available:0});
}
function drawChart(){
  if(state.chart){state.chart.destroy();state.chart=null}
  const canvas=$('histChart'),wrap=canvas.parentElement;
  if(typeof Chart==='undefined'){
    canvas.hidden=true;
    if(!wrap.querySelector('.chart-unavailable')){
      const note=document.createElement('p');note.className='chart-unavailable';
      note.textContent='No se pudo cargar el gráfico. Consulta los cortes disponibles en el selector.';
      wrap.append(note);
    }
    return;
  }
  canvas.hidden=false;
  const visible=state.index.cuts.filter(c=>c.cutoff<=cut().cutoff).slice(-12);
  state.chart=new Chart(canvas,{type:'line',data:{
    labels:visible.map(c=>c.cutoff.split('-').reverse().join('/')),
    datasets:[{label:'Existencia física · '+selectedUnit(),data:visible.map(c=>totals(c).physical),
      borderColor:'#0D6B5E',backgroundColor:'#E6F4F1',borderWidth:2,
      pointBackgroundColor:'#1B3A5C',pointRadius:4,tension:0.15,fill:false}]
  },options:{responsive:true,maintainAspectRatio:false,animation:false,
    plugins:{legend:{labels:{font:{family:'DM Sans',size:10}}},datalabels:{
      align:'top',anchor:'end',color:'#1B3A5C',font:{size:9,weight:700},formatter:num}},
    scales:{x:{ticks:{font:{size:10}},grid:{display:false}},
      y:{beginAtZero:true,ticks:{font:{size:10}},grid:{color:'#E2E8F0'}}}}});
}
function rowsFiltered(){
  if(!state.detail)return [];
  const s=scope(),q=$('histSearch').value.trim().toLocaleLowerCase('es');
  return histGrid.apply(state.detail.stock.filter(r=>M.matchScope(r,s)&&(!q||
    (r.ref+' '+r.name).toLocaleLowerCase('es').includes(q)))
    .sort((a,b)=>a.company.localeCompare(b.company)||a.warehouse.localeCompare(b.warehouse)||
      a.ref.localeCompare(b.ref)));
}
function renderRows(){
  const rows=rowsFiltered(),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  state.page=Math.min(state.page,pages-1);
  $('histCount').textContent=num(rows.length)+' posiciones · página '+(state.page+1)+' de '+pages;
  const pageRows=rows.slice(state.page*pageSize,(state.page+1)*pageSize);
  $('histRows').innerHTML=pageRows.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+
    esc(r.warehouse)+' · '+esc(M.WAREHOUSES[r.warehouse])+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+
    '</td><td class="num">'+num(r.committed)+'</td><td class="num">'+num(r.available)+
    '</td><td class="num">'+money(r.costTotal)+'</td></tr>').join('')||
    '<tr><td colspan="9" class="empty">Sin materiales para estos filtros</td></tr>';
  $('histPrev').disabled=state.page===0;
  $('histNext').disabled=state.page>=pages-1;
}
function render(){
  const current=cut();if(!current||!state.detail)return;
  const t=totals(current),compare=state.index.cuts.find(c=>c.id===$('histCompare').value);
  $('histValue').textContent=money(t.value);$('histPositions').textContent=num(t.positions);
  $('histPhysical').textContent=num(t.physical);$('histUnitLabel').textContent=selectedUnit()+' · existencia física';
  $('histCommitted').textContent=num(t.committed)+' '+selectedUnit();
  $('histAvailable').textContent=num(t.available)+' '+selectedUnit()+' disponibles';
  $('histDelta').textContent=compare
    ?'Variación frente al '+compare.cutoff+': '+(t.physical-totals(compare).physical>=0?'+':'')+
      num(t.physical-totals(compare).physical)+' '+selectedUnit()+' de existencia física.'
    :'Se necesitan dos cortes para comparar.';
  $('histCoverage').textContent='Corte '+current.cutoff+' · movimientos exportados del '+current.from+
    ' al '+current.to+'. Las existencias corresponden solo a la fecha de corte.';
  $('histChartNote').textContent=state.index.cuts.length===1
    ?'Primer corte conservado. La evolución aparecerá con la próxima carga.'
    :'Cada punto corresponde a un corte real; las existencias no se suman entre fechas.';
  drawChart();renderRows();
}
async function selectCut(){
  const token=++state.request,current=cut();
  if(!current)return;
  state.detail=null;$('histBody').hidden=true;
  message('Consultando el corte '+current.cutoff+'…','loading');
  try{
    const {sid,key}=await connection();
    const data=await payload(sid,key,current.detail);
    if(token!==state.request)return;
    if(data.schema!==1||data.cutoff!==current.cutoff||
       data.stock.length!==current.stockRows||data.movements.length!==current.movementRows)
      throw Error('El detalle no corresponde al corte seleccionado.');
    state.detail={stock:data.stock.map(r=>({company:String(r[0]),warehouse:String(r[1]),ref:String(r[2]),
      name:String(r[3]),unit:String(r[4]),physical:Number(r[5]),committed:Number(r[6]),
      available:Number(r[7]),costTotal:Number(r[9])}))};
    state.page=0;$('histBody').hidden=false;
    message('Corte '+current.cutoff+' verificado · '+num(current.stockRows)+' posiciones.');
    render();
  }catch(error){
    if(token!==state.request)return;
    $('histBody').hidden=true;message(error.message||'No se pudo consultar el histórico.','error');
  }
}
async function readIndex(force=false){
  if(state.index&&!force)return state.index;
  if(indexPromise)return indexPromise;
  indexPromise=(async()=>{
    const {sid,key}=await connection();
    const control=await values(sid,key,'LOG_Hist_Control','A1');
    const descriptor=JSON.parse(control[0]?.[0]||'null');
    if(!descriptor||descriptor.schema!==1)throw Error('La consulta histórica aún no está publicada.');
    const index=await payload(sid,key,descriptor);
    if(index.schema!==1||!Array.isArray(index.cuts)||!index.cuts.length||
       index.cuts.some(c=>!Array.isArray(c.summary)||!c.detail))
      throw Error('No hay cortes históricos válidos para consultar.');
    state.index=index;return index;
  })();
  try{return await indexPromise}finally{indexPromise=null}
}
async function load(force=false){
  ++state.request;state.detail=null;$('histBody').hidden=true;
  message('Consultando cortes conservados…','loading');
  try{
    await readIndex(force);chooseOptions();await selectCut();
  }catch(error){$('histBody').hidden=true;message(error.message||'No se pudo consultar el histórico.','error')}
}
function csv(){
  if(!state.detail)return;
  const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
  const rows=[['Corte','Empresa','Bodega','Referencia','Material','Unidad','Físico',
    'Comprometido','Disponible','Valor según SIESA ($)'],...rowsFiltered().map(r=>[
    cut().cutoff,r.company,r.warehouse,r.ref,r.name,r.unit,r.physical,r.committed,r.available,r.costTotal])];
  const text='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='Logistica_historico_'+cut().cutoff+'.csv';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelector('[data-page="historico"]').addEventListener('click',()=>{
  if(!state.detail)load();else render();
});
$('histRefresh').addEventListener('click',()=>load(true));
$('histCut').addEventListener('change',()=>{updateComparisons();selectCut()});
$('histCompare').addEventListener('change',render);
$('histSearch').addEventListener('input',()=>{state.page=0;renderRows()});
$('histPrev').addEventListener('click',()=>{state.page--;renderRows()});
$('histNext').addEventListener('click',()=>{state.page++;renderRows()});
$('histCsv').addEventListener('click',csv);
for(const id of ['company','type','warehouse','unit'])$(id).addEventListener('change',render);
window.PccLogisticsHistory={readIndex};
})();
