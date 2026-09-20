/* Current stock plus verified month-end cuts, with one scope for units and COP. */
(function(){
'use strict';
const M=PccHistoryModel,$=id=>document.getElementById(id),money=PccMoney.format;
const num=n=>Number.isFinite(n)?n.toLocaleString('es-CO',{maximumFractionDigits:2}):'—';
const date=d=>d?d.split('-').reverse().join('/'):'—';
const month=m=>new Date(m+'-15T12:00:00Z').toLocaleDateString('es-CO',{month:'short',year:'numeric',timeZone:'UTC'});
let request=0,charts=[];
const type=p=>p.current?(p.closed?'Cierre y actual':'Actual · en curso'):p.closed?'Cierre mensual':'Sin cierre';
function clear(){charts.forEach(c=>c.destroy());charts=[];$('inventory-monthly-rows').replaceChildren();}
function draw(points){
 clear();
 $('inventory-monthly-rows').replaceChildren(...points.map(p=>{
  const row=document.createElement('tr');
  for(const value of [month(p.month),type(p),date(p.cutoff),num(p.units),money(p.amount)+(p.amount!==null&&p.totals?.missingCostUnits?' · parcial':''),num(p.totals?.missingCostUnits)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  return row;
 }));
 if(typeof Chart==='undefined')return;
 for(const [suffix,key]of [['units','units'],['value','amount']]){
  const cash=key==='amount',canvas=$('inventory-monthly-'+suffix),values=points.map(p=>p[key]);
  canvas.parentElement.style.height=Math.max(175,points.length*58)+'px';
  const formatted=(v,i)=>v===null?'':(cash?money(v):num(v))+(cash&&points[i].totals?.missingCostUnits?' *':'');
  charts.push(new Chart(canvas, {
   type:'bar',
   data:{labels:points.map(p=>[month(p.month),type(p)]),datasets:[{label:cash?'Costo conocido (COP)':'Existencias (unidades)',data:values,backgroundColor:points.map(p=>p.current?'#0D6B5E':'#1B3A5C'),borderRadius:4,maxBarThickness:26}]},
   options:{
    indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,
    layout:{padding:{right:cash?174:82,top:8,bottom:8}},
    plugins:{
     legend:{display:false},
     datalabels:{display:ctx=>Number.isFinite(ctx.dataset.data[ctx.dataIndex]),anchor:'end',align:'right',offset:6,color:'#1B3A5C',font:{size:12,weight:'600'},formatter:(v,ctx)=>formatted(v,ctx.dataIndex)},
     tooltip:{callbacks:{label:ctx=>formatted(ctx.raw,ctx.dataIndex),afterLabel:ctx=>{
      const p=points[ctx.dataIndex];return ['Corte: '+date(p.cutoff),...(cash&&p.totals?.missingCostUnits?[num(p.totals.missingCostUnits)+' unidades sin costo; valor parcial']:[])];
     }}}
    },
    scales:{x:{beginAtZero:true,display:false,suggestedMax:Math.max(1,...values.filter(Number.isFinite))*1.08},y:{grid:{display:false},ticks:{autoSkip:false,font:{size:11},color:'#1B3A5C'}}}
   }
  }));
 }
}
async function render(){
 const token=++request,cutoff=resumenExistencias(INV_DATA).cutoff;
 clear();
 if(!cutoff){$('inventory-monthly-status').textContent='Se requiere un corte de inventario uniforme para mostrar la evolución.';return;}
 const current=INV_DATA.map(r=>({company:r.empresa,ref:r.ref,warehouse:r.bodega,description:r.desc,units:r.totalUds,committed:0,available:r.totalUds,knownValue:r.knownValue,missingCostUnits:r.missingCostUnits,knownCostUnits:Math.max(0,Math.abs(r.totalUds)-(r.missingCostUnits||0)),costSources:[]}));
 const taxonomy=new Map(INV_DATA.map(r=>[JSON.stringify([r.empresa,r.ref]),r.lineaReal]));
 const predicate=r=>glFilterReal({bodega:r.warehouse,lineaReal:taxonomy.get(JSON.stringify([r.company,r.ref]))||REF_MAP[r.ref]?.linea||clasificarRef(r.ref,r.company,''),desc:r.description||DESC_MAP[r.ref]||''});
 const currentPoint={month:cutoff.slice(0,7),cutoff,current:true,closed:false,rows:current};
 $('inventory-monthly-status').textContent='Consultando cierres conservados…';
 // The current point remains available even if the historical service fails.
 draw(M.inventoryMonthlyValues([currentPoint],predicate));
 try{
  const selected=await PccInventoryHistoryView.inventorySeries(cutoff);if(token!==request)return;
  const points=M.inventoryMonthlyValues(selected.map(p=>p.current?{...p,rows:current}:p),predicate);
  draw(points);
  const closed=points.filter(p=>p.closed).length,missing=points.filter(p=>!p.current&&!p.closed).length,partial=points.some(p=>p.totals?.missingCostUnits>0);
  $('inventory-monthly-status').textContent=(closed?closed+(closed===1?' cierre mensual conservado.':' cierres mensuales conservados.'):'Aún no hay cierres de mes conservados; se muestra el corte actual.')+(missing?' '+missing+(missing===1?' mes sin corte de cierre.':' meses sin corte de cierre.'):'')+(partial?' * Valor parcial: excluye unidades sin costo; “—” indica que no hay valoración informada.':'');
 }catch(err){if(token===request)$('inventory-monthly-status').textContent='Cierres no disponibles. Se muestra únicamente el corte actual verificado; pulse Actualizar para reintentar.';}
}
window.PccInventoryMonthly={render};
})();
