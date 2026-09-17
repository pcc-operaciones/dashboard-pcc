/* Historical inventory query. Only published, verified payloads are displayed. */
(function(){
'use strict';
const M=PccHistoryModel,$=id=>document.getElementById(id);
const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('es-CO',{maximumFractionDigits:1}):'—';
const date=d=>d?d.split('-').reverse().join('/'):'—';
let query=null,selected=null,comparison=null,request=0,page=0,tableRows=[],charts=[],detailCache=new Map();
function option(value,label){const n=e('option',label);n.value=value;return n;}
async function values(sheet,range){
 const response=await fetch(`${BASE}/${INV_SHEET_ID}/values/${encodeURIComponent(sheet+'!'+range)}?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&_=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(response.status===400?'La consulta histórica aún no está publicada.':'No se pudo consultar el histórico.');
 return (await response.json()).values||[];
}
async function payload(d){
 if(!Number.isInteger(d.row)||d.row<2||!Number.isInteger(d.count)||d.count<1||d.count>5000||!/^[a-f0-9]{64}$/.test(d.hash))throw Error('Índice histórico no válido.');
 const rows=await values('INV_Hist_Datos',`A${d.row}:A${d.row+d.count-1}`);
 if(rows.length!==d.count||rows.some(r=>typeof r[0]!=='string'||!r[0].startsWith('j')))throw Error('La consulta está incompleta. Vuelve a consultar.');
 const text=rows.map(r=>r[0].slice(1)).join('');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==d.hash)throw Error('La consulta no superó la comprobación de integridad. Vuelve a consultar.');
 const data=JSON.parse(text);if(data.schema!==1)throw Error('Versión histórica no compatible.');return data;
}
async function detail(cut){
 if(!cut)return null;
 if(!detailCache.has(cut.detail.hash)){
  const data=await payload(cut.detail);
  if(data.cutoff!==cut.cutoff||!Array.isArray(data.rows))throw Error('El detalle no corresponde al corte seleccionado.');
  detailCache.set(cut.detail.hash,data);
 }
 return detailCache.get(cut.detail.hash);
}
function busy(value){$('hist-body').hidden=value;$('hist-loading').hidden=!value;$('hist-controls').disabled=value;$('hist-refresh').disabled=value;}
function clearVisuals(){selected=null;comparison=null;tableRows=[];$('hist-body').hidden=true;for(const ch of charts)ch.destroy();charts=[];}
function error(message){clearVisuals();$('hist-loading').hidden=true;$('hist-controls').disabled=false;$('hist-refresh').disabled=false;$('hist-message').textContent=message+' Usa «Consultar cortes» para reintentar.';}
async function load(){
 const token=++request;busy(true);$('hist-message').textContent='';clearVisuals();
 try{
  const control=await values('INV_Hist_Control','A1'),d=JSON.parse(control[0]?.[0]||'null');
  if(!d||d.schema!==1)throw Error('La consulta histórica aún no está publicada.');
  const result=await payload(d);if(token!==request)return;
  if(!Array.isArray(result.cuts)||!result.cuts.length)throw Error('Aún no hay cortes completos disponibles.');
  query=result;
  $('hist-cut').replaceChildren(...query.cuts.slice().reverse().map(c=>option(c.cutoff,date(c.cutoff))));
  $('hist-start').textContent='Cortes conservados desde '+date(query.startCutoff)+'. Las fechas corresponden al corte declarado del ERP.';
  await choose(true);
 }catch(err){if(token===request)error(err.message||'No se pudo consultar el histórico.');}
}
async function choose(resetCompare=false){
 if(!query)return;
 if(!query)return;
 const token=++request;busy(true);$('hist-message').textContent='';clearVisuals();
 const cut=query.cuts.find(c=>c.cutoff===$('hist-cut').value);
 if(!cut){error('Selecciona un corte disponible.');return;}
 if(resetCompare){
  const earlier=query.cuts.filter(c=>c.cutoff<cut.cutoff).reverse();
  $('hist-compare').replaceChildren(option('','Sin comparación'),...earlier.map(c=>option(c.cutoff,date(c.cutoff))));
  $('hist-compare').value=earlier[0]?.cutoff||'';
 }
 try{
  const compareCut=query.cuts.find(c=>c.cutoff===$('hist-compare').value);
  const [a,b]=await Promise.all([detail(cut),detail(compareCut)]);if(token!==request)return;
  selected=a;comparison=b;
  const oldWarehouse=$('hist-warehouse').value;
  const warehouses=[...new Set([...a.rows,...(b?.rows||[])].map(r=>r.warehouse))].sort();
  $('hist-warehouse').replaceChildren(option('','Todas las bodegas'),...warehouses.map(w=>option(w,w)));
  if(warehouses.includes(oldWarehouse))$('hist-warehouse').value=oldWarehouse;
  page=0;busy(false);render();
 }catch(err){if(token===request)error(err.message||'No se pudo cargar el corte.');}
}
function metric(label,value,note){const n=e('article',undefined,'hist-metric');n.append(e('span',label),e('strong',value),e('small',note));return n;}
function render(){
 if(!selected)return;
 const company=$('hist-company').value,warehouse=$('hist-warehouse').value;
 const rows=M.filterStock(selected.rows,company,warehouse),prev=comparison?M.filterStock(comparison.rows,company,warehouse):null;
 const totals=M.stockTotals(rows),delta=M.compare(rows,prev);
 $('hist-heading').textContent='Inventario al '+date(selected.cutoff);
 $('hist-metrics').replaceChildren(metric('Existencias',fmt(totals.units),'Unidades registradas'),metric('Comprometidas',fmt(totals.committed),'Unidades con compromiso'),metric('Disponibles',fmt(totals.available),'Existencias menos comprometidas'),metric('Variación de existencias',delta?(delta.units>0?'+':'')+fmt(delta.units)+' uds':'—',comparison?'Frente al '+date(comparison.cutoff)+(delta.percent===null?' · Base cero':` · ${fmt(delta.percent)}%`):'Se requieren dos cortes para comparar'));
 $('hist-scope').textContent=(company||'EU + TEX')+' · '+(warehouse||'Todas las bodegas')+' · Corte declarado del ERP';
 const monthly=M.monthly(query,selected.cutoff,company,warehouse);
 $('hist-months').replaceChildren(...monthly.map(m=>{const tr=e('tr');for(const v of [m.month,date(m.cutoff),fmt(m.units),date(m.from)+' – '+date(m.to),fmt(m.in),fmt(m.out),m.status+' · '+m.stockStatus])tr.append(e('td',v));return tr;}));
 for(const ch of charts)ch.destroy();charts=[];
 const series=query.cuts.filter(c=>c.cutoff<=selected.cutoff).map(c=>({cut:c.cutoff,units:c.summary.filter(r=>(!company||r.company===company)&&(!warehouse||r.warehouse===warehouse)).reduce((n,r)=>n+r.units,0)}));
 $('hist-chart-wrap').hidden=series.length<2;
 if(typeof Chart!=='undefined'&&series.length>1){
  charts.push(new Chart($('hist-stock-chart'),{type:'line',data:{labels:series.map(s=>date(s.cut)),datasets:[{label:'Existencias (uds)',data:series.map(s=>s.units),borderColor:'#176f65',backgroundColor:'#176f65',tension:0,pointRadius:4,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},datalabels:{display:false}},scales:{y:{beginAtZero:true}}}}));
 }
 $('hist-chart-note').textContent=query.cuts.filter(c=>c.cutoff<=selected.cutoff).length===1?'Primer corte conservado. La evolución aparecerá con las próximas cargas.':'Cada punto corresponde a un corte conservado; las existencias no se suman entre fechas.';
 renderTable();
}
function renderTable(){
 if(!selected)return;
 tableRows=M.filterStock(selected.rows,$('hist-company').value,$('hist-warehouse').value,$('hist-search').value).sort((a,b)=>b.units-a.units||a.company.localeCompare(b.company)||a.ref.localeCompare(b.ref));
 const pages=Math.max(1,Math.ceil(tableRows.length/50));page=Math.min(page,pages-1);
 $('hist-rows').replaceChildren(...tableRows.slice(page*50,page*50+50).map(r=>{const tr=e('tr');for(const v of [r.company,r.ref,r.description,r.warehouse,fmt(r.units),fmt(r.committed),fmt(r.available)])tr.append(e('td',v));return tr;}));
 if(!tableRows.length){const tr=e('tr'),td=e('td','No hay referencias que coincidan con estos filtros.');td.colSpan=7;tr.append(td);$('hist-rows').append(tr);}
 $('hist-pagination').textContent=`${fmt(tableRows.length)} registros · Página ${page+1} de ${pages}`;
 $('hist-prev').disabled=page===0;$('hist-next').disabled=page+1>=pages;
}
function download(){
 if(!selected)return;
 const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const rows=[['Corte ERP','Empresa','Referencia','Descripción','Bodega','Existencias','Comprometidas','Disponibles'],...tableRows.map(r=>[selected.cutoff,r.company,r.ref,r.description,r.warehouse,r.units,r.committed,r.available])];
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=e('a');a.href=url;a.download='Inventario_PT_'+selected.cutoff+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function mount(){
 const panel=$('page-historico');panel.innerHTML=`
  <div class="hist-title"><div><h2>Histórico de inventario</h2><p id="hist-start">Consulta existencias y movimientos desde la puesta en marcha.</p></div><button id="hist-refresh" type="button">Consultar cortes</button></div>
  <p id="hist-message" role="status"></p>
  <fieldset id="hist-controls" class="hist-controls"><legend class="hist-sr">Consultar un corte de inventario</legend>
   <label>Corte disponible<select id="hist-cut" aria-label="Corte disponible"></select></label>
   <label>Comparar con<select id="hist-compare" aria-label="Comparar con"><option value="">Sin comparación</option></select></label>
   <label>Empresa<select id="hist-company"><option value="">EU + TEX</option><option>EU</option><option>TEX</option></select></label>
   <label>Bodega<select id="hist-warehouse"><option value="">Todas las bodegas</option></select></label>
  </fieldset>
  <p id="hist-loading" role="status" hidden>Consultando cortes conservados…</p>
  <div id="hist-body" hidden>
   <div class="hist-cut-title"><h3 id="hist-heading"></h3><span id="hist-scope"></span></div>
   <div id="hist-metrics" class="hist-metrics"></div>
   <section class="hist-panel"><h3>Evolución de existencias</h3><p id="hist-chart-note"></p><div class="hist-chart" id="hist-chart-wrap"><canvas id="hist-stock-chart" role="img" aria-label="Existencias en cada corte conservado"></canvas></div></section>
   <section class="hist-panel"><h3>Comportamiento mensual</h3><p>Entradas y salidas de todos los tipos de movimiento, incluidos traslados. No equivalen a ventas. Se presentan con la última información conservada, limitada a la fecha elegida.</p><div class="hist-scroll"><table><thead><tr><th>Mes</th><th>Corte de existencias</th><th>Existencias</th><th>Período de movimientos</th><th>Entradas (uds)</th><th>Salidas (uds)</th><th>Cobertura</th></tr></thead><tbody id="hist-months"></tbody></table></div></section>
   <section class="hist-panel"><div class="hist-title"><div><h3>Existencias por referencia y bodega</h3><p>Incluye todas las tallas y colores de cada referencia.</p></div><button id="hist-export" type="button">Descargar CSV</button></div><label class="hist-search">Buscar en el detalle<input id="hist-search" type="search" placeholder="Referencia o descripción"></label><div class="hist-scroll"><table><thead><tr><th>Empresa</th><th>Referencia</th><th>Descripción</th><th>Bodega</th><th>Existencias</th><th>Comprometidas</th><th>Disponibles</th></tr></thead><tbody id="hist-rows"></tbody></table></div><div class="hist-pages"><span id="hist-pagination"></span><button id="hist-prev" type="button">Anterior</button><button id="hist-next" type="button">Siguiente</button></div></section>
   <details class="hist-panel"><summary>Cómo leer estos datos</summary><p>Solo se ofrecen cortes completos conservados. La fecha de consulta y la ejecución automática no cambian la fecha del inventario. Un corte de fin de mes requiere una exportación de ese día; el último corte disponible puede ser de otra fecha.</p><p>Un guion en movimientos indica cobertura incompleta, no cero. El primer mes empieza en la fecha de puesta en marcha. Una corrección del mismo corte reemplaza su versión de consulta; las versiones originales permanecen en el archivo privado.</p><p>Valoración, antigüedad y obsolescencia históricas no están disponibles porque los Excel de existencias no incluyen su base. Las otras secciones de Inventario PT conservan su consulta actual.</p></details>
  </div>`;
 $('hist-refresh').addEventListener('click',load);
 $('hist-cut').addEventListener('change',()=>choose(true));$('hist-compare').addEventListener('change',()=>choose());
 for(const id of ['hist-company','hist-warehouse'])$(id).addEventListener('change',()=>{page=0;render();});
 $('hist-search').addEventListener('input',()=>{page=0;renderTable();});
 $('hist-prev').addEventListener('click',()=>{page--;renderTable();});$('hist-next').addEventListener('click',()=>{page++;renderTable();});$('hist-export').addEventListener('click',download);
}
mount();
window.PccInventoryHistoryView={open(){showTab('historico',$('hist-nav'));if(!query)load();},refresh:load};
if(location.hash==='#historico')window.PccInventoryHistoryView.open();
})();
