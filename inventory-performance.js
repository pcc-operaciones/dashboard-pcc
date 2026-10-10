/* Monthly KPIs use immutable closing cuts, including their own costs and FIFO age. */
(function(){
'use strict';
const M=PccHistoryModel,$=id=>document.getElementById(id),num=v=>Number.isFinite(v)?v.toLocaleString('es-CO',{maximumFractionDigits:0}):'—';
const money=v=>Number.isFinite(v)?PccMoney.format(v):'—',date=v=>v?v.split('-').reverse().join('/'):'—';
const month=m=>new Date(m+'-01T12:00:00').toLocaleDateString('es-CO',{month:'short',year:'numeric'});
let request=0;
function draw(points){
 for(const key of ['_ch1','_ch4','_ch4money'])destroyChart(key);
 const obs=points.map(p=>p.values.obsolescence);
 window._ch1=new Chart($('chart1'),{type:'line',data:{labels:points.map(p=>month(p.month)),datasets:[
  {label:'Obsolescencia',data:obs,borderColor:'#B03030',backgroundColor:'#B03030',pointRadius:4,tension:0,spanGaps:false},
  {label:'Meta 5%',data:points.map(()=>5),borderColor:'rgba(176,48,48,.4)',borderDash:[5,4],pointRadius:0,datalabels:{display:false}}]},
  options:{responsive:true,layout:{padding:{top:25,left:22,right:28}},plugins:{legend:{display:false},datalabels:{display:c=>c.datasetIndex===0&&Number.isFinite(c.dataset.data[c.dataIndex]),align:'top',anchor:'end',color:'#B03030',font:{size:11,weight:'600'},formatter:v=>v.toLocaleString('es-CO',{maximumFractionDigits:1})+'%'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.raw.toLocaleString('es-CO',{maximumFractionDigits:1})+'%',afterLabel:c=>'Corte: '+date(points[c.dataIndex].cutoff)}}},scales:{x:{grid:{display:false}},y:{beginAtZero:true,suggestedMax:Math.max(5,...obs.filter(Number.isFinite))*1.2,ticks:{callback:v=>v+'%'}}}}});
 for(const [id,key,handle]of [['chart4','units','_ch4'],['chart4-money','amount','_ch4money']]){
  const cash=key==='amount',values=points.map(p=>p.values[key]),canvas=$(id);
  canvas.parentElement.style.height=Math.max(190,points.length*65)+'px';
  const label=(v,i)=>(cash?money(v):num(v))+(cash&&points[i].values.missingCostUnits?' *':'');
  window[handle]=new Chart(canvas,{type:'bar',data:{labels:points.map(p=>[month(p.month),p.current?(p.closed?'Cierre y actual':'Actual · en curso'):p.closed?'Cierre mensual':'Sin cierre']),datasets:[{label:cash?'Costo de despachos (COP)':'Despachos RM (uds)',data:values,backgroundColor:points.map(p=>p.current?'#0D6B5E':'#9BC2BE'),borderRadius:4,maxBarThickness:27}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,layout:{padding:{right:cash?150:70,top:12,bottom:10}},plugins:{legend:{display:false},datalabels:{display:c=>Number.isFinite(c.dataset.data[c.dataIndex]),anchor:'end',align:'right',offset:6,color:'#1B3A5C',font:{size:11,weight:'600'},formatter:(v,c)=>label(v,c.dataIndex)},tooltip:{callbacks:{label:c=>label(c.raw,c.dataIndex),afterLabel:c=>['Corte: '+date(points[c.dataIndex].cutoff),...(cash&&points[c.dataIndex].values.missingCostUnits?[num(points[c.dataIndex].values.missingCostUnits)+' unidades sin costo informado']:[])]}}},scales:{x:{display:false,beginAtZero:true,suggestedMax:Math.max(1,...values.filter(Number.isFinite))*1.08},y:{grid:{display:false},ticks:{autoSkip:false,font:{size:11}}}}}});
 }
 const current=points.find(p=>p.current);
 $('ch4-val').textContent=num(current?.values.units);
 $('performance-rows').replaceChildren(...points.map(p=>{
  const row=document.createElement('tr'),v=p.values;
  for(const text of [month(p.month),date(p.cutoff),p.current?(p.closed?'Cierre y actual':'Actual · en curso'):p.closed?'Cierre mensual':'Sin cierre',Number.isFinite(v.obsolescence)?v.obsolescence.toLocaleString('es-CO',{maximumFractionDigits:1})+'%':'—',num(v.units),money(v.amount)+(v.missingCostUnits&&v.amount!==null?' · parcial':'')]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}return row;
 }));
}
async function render(){
 const token=++request,cutoff=resumenExistencias(INV_DATA).cutoff;
 const inv=INV_DATA.filter(r=>!r.esSeg&&!r.esCobros&&glFilter(r)),cost=inv.reduce((n,r)=>n+r.c0+r.c1+r.c2+r.c3,0),risk=inv.reduce((n,r)=>n+r.c3,0);
 const current={month:cutoff?.slice(0,7),cutoff,current:true,closed:false,values:{obsolescence:cost>0?risk/cost*100:null,units:null,amount:null}};
 if(!cutoff)return;
 draw([current]);$('performance-status').textContent='Consultando cierres conservados…';$('obsol-history-note').textContent='Consultando obsolescencia de los cierres…';
 try{
  const series=await PccInventoryHistoryView.performanceSeries(cutoff);if(token!==request)return;
  const taxonomy=new Map(INV_DATA.map(r=>[JSON.stringify([r.empresa,r.ref]),r.lineaReal]));
  MOV_DATA.forEach(r=>{const k=JSON.stringify([r.empresa,r.ref]);if(!taxonomy.has(k)&&r.linea)taxonomy.set(k,r.linea);});
  const predicate=r=>glFilter({bodega:r.warehouse,linea:taxonomy.get(JSON.stringify([r.company,r.ref]))||REF_MAP[r.ref]?.linea||clasificarRef(r.ref,r.company,''),desc:DESC_MAP[r.ref]||r.description||''});
  const points=series.map(p=>({...p,values:M.performanceAtCut(p.detail,predicate)}));
  // Keep the verified current KPI visible while older publications are being upgraded.
  points.forEach(p=>{if(p.current&&p.values.obsolescence===null)p.values.obsolescence=current.values.obsolescence;});
  draw(points);
  const pending=points.some(p=>p.cut&&!p.detail?.performance),partial=points.some(p=>p.values.missingCostUnits>0);
  $('performance-status').textContent=pending?'Métricas de los cortes pendientes de publicación. No se sustituyen por datos de una carga posterior.':'Cierres conservados y mes actual hasta '+date(cutoff)+'. Verde: mes del corte actual.'+(partial?' * Costo parcial: hay despachos sin costo informado.':'');
  $('obsol-history-note').textContent=pending?'Antigüedad histórica pendiente de publicación.':'Costo conocido de primeras con más de 90 días / costo conocido de primeras, en cada corte.';
 }catch(err){if(token!==request)return;$('performance-status').textContent='No se pudieron consultar los cierres. Pulse Actualizar para reintentar.';$('obsol-history-note').textContent='Solo se muestra el corte actual; históricos no disponibles.';}
}
window.PccInventoryPerformance={render};
})();
