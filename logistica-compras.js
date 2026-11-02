(()=>{'use strict';
const M=window.PccLogisticsPurchasesModel,$=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat('es-CO',{maximumFractionDigits:2});
const compact=new Intl.NumberFormat('es-CO',{notation:'compact',maximumFractionDigits:1});
const num=v=>fmt.format(v||0),money=v=>'$ '+num(v),short=v=>'$ '+compact.format(v||0);
const metric=()=>$('buyMetric').value==='quantity'?'quantity':'money';
const metricValue=(r,key)=>metric()==='money'?r[key+'Value']:r[key];
const metricText=v=>metric()==='money'?money(v):num(v)+' MT';
const metricShort=v=>metric()==='money'?short(v):compact.format(v||0)+' MT';
const chartMax=values=>{const max=Math.max(0,...values.map(v=>Number(v)||0));return max>0?max*1.22:undefined;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const state={rows:[],stock:[],moves:[],cut:'',movementFrom:'',movementTo:'',
  meta:null,history:false,pageStock:0,pageLines:0,chart:{},detail:null};
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
function csv(name,head,rows){
  const blob=new Blob(['\uFEFF'+[head,...rows].map(r=>r.map(quote).join(';')).join('\r\n')],
    {type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function control(grid){
  const out={};for(const r of grid.slice(1))if(r.length>=2)out[String(r[0])]=String(r[1]);return out;
}
function showStatus(message,kind='warn'){
  $('buyStatus').textContent=message;$('buyStatus').className='banner '+kind;
}
function options(id,values,all){
  const target=$(id),prior=target.value;
  target.innerHTML='<option value="all">'+all+'</option>'+values.map(v=>
    '<option value="'+esc(v.key)+'">'+esc(v.name)+'</option>').join('');
  if(values.some(v=>v.key===prior))target.value=prior;
}
function filterOptions(){
  const company=$('company').value,source=state.rows.filter(r=>company==='all'||r.company===company);
  for(const [field,id,label] of [['buyer','buyBuyer','Todos los compradores'],
    ['supplier','buySupplier','Todos los proveedores']]){
    const map=new Map();for(const r of source)map.set(M.identity(r[field]),M.display(r[field]));
    options(id,[...map].map(([key,name])=>({key,name})).sort((a,b)=>a.name.localeCompare(b.name)),label);
  }
}
function chart(id,labels,values,color,onSelect){
  if(state.chart[id])state.chart[id].destroy();
  const canvas=$(id);
  if(typeof Chart==='undefined'){
    canvas.hidden=true;
    if(!canvas.parentElement.querySelector('.chart-unavailable')){
      const note=document.createElement('p');note.className='chart-unavailable';
      note.textContent='Gráfico no disponible; consulte la tabla inferior.';canvas.parentElement.append(note);
    }
    return;
  }
  canvas.hidden=false;
  canvas.style.cursor='pointer';
  state.chart[id]=new Chart(canvas,{type:'bar',data:{labels,datasets:[{data:values,
    backgroundColor:color,borderRadius:4,label:'Valor neto'}]},options:{indexAxis:'y',
    responsive:true,maintainAspectRatio:false,animation:false,
    onClick:(_event,elements)=>{if(elements.length)onSelect?.(elements[0].index);},
    layout:{padding:{right:60}},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>metricText(c.parsed.x)}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])!==0,
        anchor:'end',align:'end',clip:false,color:'#1B3A5C',font:{size:9,weight:700},formatter:metricShort}},
    scales:{x:{beginAtZero:true,max:chartMax(values),ticks:{callback:metricShort},grid:{color:'#e2e8f0'}},
      y:{ticks:{font:{size:10}},grid:{display:false}}}}});
}
function monthlyChart(rows){
  const id='buyMonthlyChart';if(state.chart[id])state.chart[id].destroy();
  const canvas=$(id);
  if(typeof Chart==='undefined'){
    canvas.hidden=true;
    if(!canvas.parentElement.querySelector('.chart-unavailable')){
      const p=document.createElement('p');p.className='chart-unavailable';
      p.textContent='Gráfico no disponible; consulte la tabla inferior.';canvas.parentElement.append(p);
    }
    return;
  }
  canvas.hidden=false;
  canvas.style.cursor='pointer';
  const months=[...new Set(rows.map(r=>r.month))];
  const companies=$('company').value==='all'?['EU+TEX']:[$('company').value];
  const quantity=metric()==='quantity',key=quantity?'netQty':'net';
  const datasets=companies.map((company,i)=>({label:company,
    data:months.map(month=>rows.find(r=>r.company===company&&r.month===month)?.[key]||0),
    backgroundColor:i?'#4E6F98':'#0D6B5E',borderRadius:4}));
  state.chart[id]=new Chart(canvas,{type:'bar',data:{labels:months,datasets},options:{
    responsive:true,maintainAspectRatio:false,animation:false,
    onClick:(_event,elements)=>{
      if(!elements.length)return;const point=elements[0];
      openPurchaseDetail('Compras '+months[point.index]+' · '+companies[point.datasetIndex],
        buyRows().filter(r=>r.date.slice(0,7)===months[point.index]&&
          (metric()==='money'||r.unit==='MT')&&
          (companies[point.datasetIndex]==='EU+TEX'||r.company===companies[point.datasetIndex])));
    },
    plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+metricText(c.parsed.y)}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])!==0,
        anchor:'end',align:'end',clip:false,font:{size:9,weight:700},formatter:metricShort}},
    scales:{y:{beginAtZero:true,max:chartMax(datasets.flatMap(d=>d.data)),ticks:{callback:metricShort}}}}});
}
function buyRows(){
  return M.select(state.rows,{company:$('company').value,
    from:$('buyFrom').value,to:$('buyTo').value,buyer:$('buyBuyer').value,
    supplier:$('buySupplier').value});
}
function visibleStocks(){
  return M.stockLinks(state.stock,state.rows,state.cut,$('company').value);
}
function renderRankings(rows){
  const combine=$('company').value==='all';
  const quantity=metric()==='quantity';
  for(const [key,body,total,chartId,color] of [
    ['buyer','buyBuyerRows','buyBuyerTotal','buyBuyerChart','#0D6B5E'],
    ['supplier','buySupplierRows','buySupplierTotal','buySupplierChart','#1B3A5C']]){
    const source=quantity?rows.filter(r=>r.unit==='MT'):rows;
    const ranked=M.ranking(source,key,combine).sort((a,b)=>
      (quantity?b.quantity-a.quantity:b.value-a.value)||a.name.localeCompare(b.name));
    const top=ranked.slice(0,10),valueKey=quantity?'quantity':'value';
    const prefix=key==='buyer'?'buyBuyer':'buySupplier';
    $(prefix+'Title').textContent=key==='buyer'?(quantity?'Metros netos por comprador':'Valor neto por comprador'):
      (quantity?'Proveedores con mayor cantidad · MT':'Proveedores con mayor valor');
    $(prefix+'MetricHead').textContent=quantity?'Cantidad neta · MT':'Valor neto';
    $(body).innerHTML=ranked.map(r=>'<tr><td>'+esc(r.company)+'</td><td><button type="button" class="buy-drill" data-kind="'+key+'" data-key="'+esc(r.identity)+'">'+esc(r.name)+'</button>'+
      '</td><td class="num">'+num(r.lines)+'</td><td class="num">'+
      (quantity?num(r.quantity)+' MT':money(r.value))+'</td></tr>').join('')||
      '<tr><td colspan="4" class="empty">Sin registros</td></tr>';
    $(total).innerHTML='<tr><td colspan="2">TOTAL FILTRADO</td><td class="num">'+
      num(ranked.reduce((a,r)=>a+r.lines,0))+'</td><td class="num">'+
      (quantity?num(ranked.reduce((a,r)=>a+r.quantity,0))+' MT':
        money(ranked.reduce((a,r)=>a+r.value,0)))+'</td></tr>';
    if($('page-compras').classList.contains('active'))
      chart(chartId,top.map(r=>r.name),top.map(r=>r[valueKey]),color,index=>{
        const selected=top[index];
        openPurchaseDetail((key==='buyer'?'Comprador: ':'Proveedor: ')+selected.name,
          source.filter(row=>M.identity(row[key])===selected.identity));
      });
  }
}
function renderMonthly(rows){
  const quantity=metric()==='quantity',source=quantity?rows.filter(r=>r.unit==='MT'):rows;
  const monthly=M.monthly(source,$('company').value==='all');
  $('buyMonthlyTitle').textContent=quantity?'Metros mensuales comprados · MT':
    'Valor mensual de compras registradas';
  for(const [id,label] of [['buyMonthlyEacHead','EAC'],['buyMonthlyDcpHead','DCP'],
    ['buyMonthlyNetHead','Neto']])$(id).textContent=label+' · '+(quantity?'MT':'$');
  const keys=quantity?['receiptQty','returnQty','netQty']:['receipts','returns','net'];
  $('buyMonthlyRows').innerHTML=monthly.map(r=>'<tr><td><button type="button" class="buy-drill" data-kind="month" data-key="'+esc(r.month)+'">'+esc(r.month)+'</button></td><td>'+esc(r.company)+
    '</td>'+keys.map(k=>'<td class="num">'+metricText(r[k])+'</td>').join('')+'</tr>').join('')||
    '<tr><td colspan="5" class="empty">Sin registros</td></tr>';
  $('buyMonthlyTotal').innerHTML='<tr><td colspan="2">TOTAL FILTRADO</td>'+keys
    .map(k=>'<td class="num">'+metricText(monthly.reduce((a,r)=>a+r[k],0))+'</td>').join('')+'</tr>';
  if($('page-compras').classList.contains('active'))monthlyChart(monthly);
}
function comparisonRange(){
  const from=$('buyFrom').value>state.movementFrom?$('buyFrom').value:state.movementFrom;
  const to=[ $('buyTo').value,state.movementTo,state.cut ].sort()[0];
  return {from,to,valid:from<=to};
}
function renderConsumption(){
  const {from,to,valid}=comparisonRange(),unit='MT',company=$('company').value;
  const result=valid?M.buyerConsumption(state.rows,state.moves,from,to,company,unit):
    {rows:[],purchased:0,consumed:0,unattributed:0};
  let rows=result.rows;
  if($('buyBuyer').value!=='all')rows=rows.filter(r=>r.identity===$('buyBuyer').value);
  const quantity=metric()==='quantity';
  const note=valid?'Período comparable '+from+' a '+to+' · telas en '+unit+
    '. Compra neta EAC + DCP; consumo CPN − DCN de referencias con un único comprador observado antes de cada movimiento'+
    '. Las referencias con varios o ningún comprador van a «Sin atribuir».':'No hay fechas comunes entre compras y movimientos.';
  $('buyConsumptionNote').textContent=note+
    (valid?' Consumo sin atribuir: '+num(result.unattributed)+' '+unit+'.':'')+
    (quantity?'':' En $ se compara valor bruto de compra con costo de salida neto SIESA; son bases distintas.')+
    ' El proveedor seleccionado no restringe este comparativo; no se conoce el proveedor de las unidades consumidas.';
  $('buyComparisonPurchaseHead').textContent=quantity?'Compra neta · MT':'Valor neto compra · $';
  $('buyComparisonConsumptionHead').textContent=quantity?'Consumo asociado · MT':'Costo neto consumo · $';
  $('buyConsumptionRows').innerHTML=rows.map(r=>'<tr><td><button type="button" class="buy-drill" data-kind="consumption" data-key="'+esc(r.identity)+'">'+esc(r.name)+'</button></td><td class="num">'+metricText(metricValue(r,'purchased'))+
    '</td><td class="num">'+metricText(metricValue(r,'consumed'))+'</td></tr>').join('')||
    '<tr><td colspan="3" class="empty">Sin datos comparables para esta selección.</td></tr>';
  $('buyConsumptionTotal').innerHTML='<tr><td>TOTAL MOSTRADO</td><td class="num">'+
    metricText(rows.reduce((a,r)=>a+metricValue(r,'purchased'),0))+'</td><td class="num">'+
    metricText(rows.reduce((a,r)=>a+metricValue(r,'consumed'),0))+'</td></tr>';
  state.comparison=result;
  if(!$('page-compras').classList.contains('active'))return;
  const id='buyConsumptionChart';if(state.chart[id])state.chart[id].destroy();
  if(typeof Chart==='undefined'){
    $(id).hidden=true;return;
  }
  const canvas=$(id);canvas.hidden=false;canvas.style.cursor='pointer';
  const top=rows.slice(0,10),labels=top.map(r=>r.name);
  state.chart[id]=new Chart(canvas,{type:'bar',data:{labels,datasets:[
    {label:quantity?'Compra neta · MT':'Valor neto compra · $',
      data:top.map(r=>metricValue(r,'purchased')),backgroundColor:'#0D6B5E',borderRadius:3},
    {label:quantity?'Consumo asociado · MT':'Costo neto consumo · $',
      data:top.map(r=>metricValue(r,'consumed')),backgroundColor:'#1B3A5C',borderRadius:3}
  ]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,animation:false,
    layout:{padding:{right:60}},
    onClick:(_event,elements)=>{
      if(!elements.length)return;const point=elements[0],item=top[point.index];
      if(point.datasetIndex===0)openPurchaseDetail('Compras de '+item.name,item.purchaseRows,
        'Compra neta del período comparable · '+unit);
      else openMovementDetail('Consumo asociado a '+item.name,item.movementRows,
        'CPN − DCN de referencias con '+(item.identity==='__SIN_ATRIBUIR__'?
          'varios o ningún comprador observado':'un solo comprador observado')+'.');
    },
    plugins:{tooltip:{callbacks:{label:c=>c.dataset.label+': '+metricText(c.parsed.x)}},
      datalabels:{display:c=>Number(c.dataset.data[c.dataIndex])>0,
        anchor:'end',align:'end',clip:false,font:{size:9,weight:700},formatter:metricShort}},
    scales:{x:{beginAtZero:true,
      max:chartMax(top.flatMap(r=>[metricValue(r,'purchased'),metricValue(r,'consumed')])),
      ticks:{callback:metricShort}},y:{ticks:{font:{size:10}}}}}});
}
function renderPrices(rows){
  let data=M.priceChanges(rows),q=$('buyPriceSearch').value.trim().toLocaleLowerCase('es');
  if(q)data=data.filter(r=>(r.ref+' '+r.name+' '+r.supplier).toLocaleLowerCase('es').includes(q));
  const mode=$('buyPriceSort').value;
  data.sort((a,b)=>mode==='ref'?a.ref.localeCompare(b.ref):
    mode==='up'?(b.percent??0)-(a.percent??0):
    mode==='down'?(a.percent??0)-(b.percent??0):
    Math.abs(b.percent??0)-Math.abs(a.percent??0));
  $('buyPriceCount').textContent=num(data.length)+' referencias/proveedor con al menos dos fechas EAC';
  $('buyPriceRows').innerHTML=data.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.supplier)+'</td><td>'+esc(r.unit)+
    '</td><td>'+esc(r.firstDate)+' / '+esc(r.lastDate)+'</td><td class="num">'+money(r.initial)+
    '</td><td class="num">'+money(r.final)+'</td><td class="num">'+
    (r.percent===null?'—':(r.percent>0?'+':'')+num(r.percent)+' %')+'</td></tr>').join('')||
    '<tr><td colspan="9" class="empty">No hay dos fechas comparables para esta selección.</td></tr>';
}
function filteredStocks(){
  let rows=visibleStocks(),q=$('buyStockSearch').value.trim().toLocaleLowerCase('es'),
    status=$('buyStockStatus').value;
  if(status!=='all')rows=rows.filter(r=>r.status===status);
  if(q)rows=rows.filter(r=>(r.ref+' '+r.name+' '+r.buyers.join(' ')).toLocaleLowerCase('es').includes(q));
  return rows;
}
function renderStocks(){
  const all=visibleStocks(),rows=filteredStocks(),pageSize=100,
    max=Math.max(0,Math.ceil(rows.length/pageSize)-1);
  state.pageStock=Math.min(state.pageStock,max);
  const shown=rows.slice(state.pageStock*pageSize,(state.pageStock+1)*pageSize),unit='MT';
  $('buyLinkStats').innerHTML='<span><strong>'+num(all.filter(r=>r.status!=='Sin compra observada').length)+
    '</strong> posiciones con compra EAC observada hasta '+esc(state.cut)+'</span><span><strong>'+
    num(all.filter(r=>r.status==='Varios compradores').length)+'</strong> con varios compradores</span><span><strong>'+
    num(all.filter(r=>r.status==='Sin compra observada').length)+'</strong> sin compra en el archivo</span>';
  $('buyStockCount').textContent=num(rows.length)+' posiciones · página '+num(state.pageStock+1)+' de '+num(max+1);
  $('buyStockRows').innerHTML=shown.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.physical)+
    ' '+esc(r.unit)+'</td><td class="num">'+money(r.value)+'</td><td>'+esc(r.buyers.join(' · ')||'—')+
    '</td><td>'+esc(r.latest||'—')+'</td><td>'+esc(r.status)+'</td></tr>').join('')||
    '<tr><td colspan="9" class="empty">Sin existencias para estos filtros.</td></tr>';
  $('buyStockTotal').innerHTML='<tr><td colspan="4">TOTAL FILTRADO · cantidad sólo '+esc(unit)+
    '</td><td class="num">'+num(rows.filter(r=>r.unit===unit).reduce((a,r)=>a+r.physical,0))+
    ' '+esc(unit)+'</td><td class="num">'+money(rows.reduce((a,r)=>a+r.value,0))+
    '</td><td colspan="3">El valor de inventario no se atribuye a compradores.</td></tr>';
  $('buyStockPrev').disabled=state.pageStock===0;$('buyStockNext').disabled=state.pageStock>=max;
}
function filteredLines(rows){
  const q=$('buyLineSearch').value.trim().toLocaleLowerCase('es');
  return q?rows.filter(r=>(r.document+' '+r.invoice+' '+r.ref+' '+r.name+' '+r.buyer+' '+r.supplier)
    .toLocaleLowerCase('es').includes(q)):rows;
}
function renderLines(rows){
  const data=filteredLines(rows).sort((a,b)=>b.date.localeCompare(a.date)||a.company.localeCompare(b.company)||
    a.document.localeCompare(b.document)||a.ref.localeCompare(b.ref));
  const pageSize=100,max=Math.max(0,Math.ceil(data.length/pageSize)-1),unit='MT';
  state.pageLines=Math.min(state.pageLines,max);
  const shown=data.slice(state.pageLines*pageSize,(state.pageLines+1)*pageSize);
  $('buyLineCount').textContent=num(data.length)+' líneas · página '+num(state.pageLines+1)+' de '+num(max+1);
  $('buyLineRows').innerHTML=shown.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.date)+
    '</td><td><span class="pill">'+esc(r.kind)+'</span></td><td>'+esc(r.document)+
    '</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.buyer)+
    '</td><td>'+esc(r.supplier)+'</td><td>'+esc(r.unit)+'</td><td class="num">'+
    num(r.qty)+'</td><td class="num">'+money(r.price)+'</td><td class="num">'+
    money(r.value)+'</td></tr>').join('')||'<tr><td colspan="12" class="empty">Sin líneas</td></tr>';
  $('buyLineTotal').innerHTML='<tr><td colspan="9">TOTAL FILTRADO · cantidad sólo '+esc(unit)+
    '</td><td class="num">'+num(data.filter(r=>r.unit===unit).reduce((a,r)=>a+r.qty,0))+
    '</td><td></td><td class="num">'+money(data.reduce((a,r)=>a+r.value,0))+'</td></tr>';
  $('buyLinePrev').disabled=state.pageLines===0;$('buyLineNext').disabled=state.pageLines>=max;
}
function openPurchaseDetail(title,rows,note='Líneas de documentos de compras del filtro seleccionado.'){
  state.detail={type:'purchase',title,rows,note,limit:100};renderDetail();$('buyDetail').showModal();
}
function openMovementDetail(title,rows,note){
  state.detail={type:'movement',title,rows,note,limit:100};renderDetail();$('buyDetail').showModal();
}
function renderDetail(){
  const detail=state.detail;if(!detail)return;
  $('buyDetailTitle').textContent=detail.title;$('buyDetailNote').textContent=detail.note;
  const selected=detail.rows.slice(0,detail.limit),purchase=detail.type==='purchase';
  $('buyDetailHead').innerHTML=purchase?
    '<tr><th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Referencia</th><th>Material</th><th>Comprador</th><th>Proveedor</th><th>U. M.</th><th class="num">Cantidad</th><th class="num">Valor</th></tr>':
    '<tr><th>Empresa</th><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Material</th><th>U. M.</th><th class="num">Consumo neto</th><th class="num">Costo neto</th></tr>';
  $('buyDetailRows').innerHTML=purchase?selected.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.date)+
    '</td><td>'+esc(r.kind)+'</td><td>'+esc(r.document)+'</td><td>'+esc(r.ref)+
    '</td><td>'+esc(r.name)+'</td><td>'+esc(r.buyer)+'</td><td>'+esc(r.supplier)+
    '</td><td>'+esc(r.unit)+'</td><td class="num">'+num(r.qty)+'</td><td class="num">'+
    money(r.value)+'</td></tr>').join(''):
    selected.map(r=>'<tr><td>'+esc(r.company)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.docType)+
    '</td><td>'+esc(r.ref)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.unit)+
    '</td><td class="num">'+num(r.docType==='CPN'?r.outQty:-r.inQty)+'</td><td class="num">'+
    money(r.docType==='CPN'?r.outCost:-r.inCost)+'</td></tr>').join('');
  const unit='MT';
  const quantity=detail.rows.reduce((a,r)=>a+(purchase?(r.unit===unit?r.qty:0):
    (r.docType==='CPN'?r.outQty:-r.inQty)),0);
  const value=detail.rows.reduce((a,r)=>a+(purchase?r.value:
    (r.docType==='CPN'?r.outCost:-r.inCost)),0);
  $('buyDetailTotal').innerHTML=purchase?'<tr><td colspan="9">TOTAL DEL DETALLE · '+
    num(detail.rows.length)+' líneas · cantidad sólo '+esc(unit)+'</td><td class="num">'+num(quantity)+
    '</td><td class="num">'+money(value)+'</td></tr>':
    '<tr><td colspan="6">TOTAL DEL DETALLE · '+num(detail.rows.length)+
    ' movimientos</td><td class="num">'+num(quantity)+'</td><td class="num">'+money(value)+'</td></tr>';
  $('buyDetailCount').textContent=num(selected.length)+' de '+num(detail.rows.length)+' líneas';
  $('buyDetailMore').hidden=selected.length>=detail.rows.length;
}
function render(){
  if(!state.meta)return;
  const rows=buyRows(),unit='MT',sum=M.summary(rows,unit);
  $('buyNet').textContent=money(sum.netValue);$('buyReceipts').textContent=money(sum.receiptValue);
  $('buyReturns').textContent=money(sum.returnValue);
  $('buyQty').textContent=num(sum.receiptQty+sum.returnQty)+' '+unit;
  $('buyReceiptsSub').textContent=num(sum.receipts)+' líneas EAC';
  $('buyReturnsSub').textContent=num(sum.returns)+' líneas DCP (valor negativo)';
  $('buyQtySub').textContent='EAC + DCP · sólo '+unit;
  renderRankings(rows);renderConsumption();renderMonthly(rows);renderPrices(rows);renderStocks();renderLines(rows);
}
async function load(read,stock,moves,mainMeta){
  try{
    const before=control(await read('LOG_Compras_Control','A:B'));
    if(before.estado!=='LISTO')throw Error('Los informes de compras aún no están publicados');
    const rows=M.parse(await read('LOG_Compras','A:O'));
    const after=control(await read('LOG_Compras_Control','A:B'));
    if(after.estado!=='LISTO'||after.version!==before.version||
       rows.length!==Number(after.filas_compras))throw Error('La carga de compras cambió durante la lectura');
    let published=rows,publishedMeta=after,history=false;
    try{
      const hBefore=control(await read('LOG_Compras_Hist_Control','A:B'));
      if(hBefore.estado==='LISTO'){
        const hRows=M.parse(await read('LOG_Compras_Hist','A:O'));
        const hAfter=control(await read('LOG_Compras_Hist_Control','A:B'));
        if(hAfter.estado!=='LISTO'||hAfter.version!==hBefore.version||
           hRows.length!==Number(hAfter.filas_compras))throw Error('Histórico incompleto');
        published=hRows;publishedMeta=hAfter;history=true;
      }
    }catch(error){console.warn('[Compras] Histórico aún no disponible:',error.message);}
    state.rows=published;state.stock=stock;state.moves=moves;
    state.cut=mainMeta.corte_inventario;state.movementFrom=mainMeta.movimientos_desde;
    state.movementTo=mainMeta.movimientos_hasta;state.meta=publishedMeta;state.history=history;
    $('buyFrom').min=publishedMeta.fecha_minima_observada;
    $('buyFrom').max=publishedMeta.fecha_maxima_observada;
    $('buyTo').min=publishedMeta.fecha_minima_observada;
    $('buyTo').max=publishedMeta.fecha_maxima_observada;
    $('buyFrom').value=publishedMeta.fecha_minima_observada;
    $('buyTo').value=publishedMeta.fecha_maxima_observada;
    $('buyPeriodNote').textContent=(history?'Histórico acumulado':'Paquete actual')+
      ' · fechas observadas: '+publishedMeta.fecha_minima_observada+' a '+
      publishedMeta.fecha_maxima_observada+' · filtro original por confirmar.';
    filterOptions();$('buyBody').hidden=false;
    showStatus(num(published.length)+' líneas de compras '+(history?'históricas':'publicadas')+
      ' · inventario para el cruce: '+state.cut+
      (history?'.':'. Histórico acumulado pendiente de publicar.'),history?'':'warn');
    render();
  }catch(error){
    $('buyBody').hidden=true;
    showStatus('Compras de telas en construcción: '+error.message+'. Publica COMPRAS EU.xlsx y COMPRAS TEX.xlsx desde Apps Script.','warn');
  }
}
for(const id of ['buyFrom','buyTo','buyBuyer','buySupplier','buyMetric','buyPriceSearch','buyPriceSort',
  'buyStockSearch','buyStockStatus','buyLineSearch'])$(id).addEventListener(id.includes('Search')?'input':'change',()=>{
  if(id==='buyFrom'&&$('buyFrom').value>$('buyTo').value)$('buyTo').value=$('buyFrom').value;
  if(id==='buyTo'&&$('buyTo').value<$('buyFrom').value)$('buyFrom').value=$('buyTo').value;
  state.pageStock=0;state.pageLines=0;render();
});
$('buyAll').addEventListener('click',()=>{
  if(!state.meta)return;$('buyFrom').value=state.meta.fecha_minima_observada;
  $('buyTo').value=state.meta.fecha_maxima_observada;render();
});
for(const [id,key,step] of [['buyStockPrev','pageStock',-1],['buyStockNext','pageStock',1],
  ['buyLinePrev','pageLines',-1],['buyLineNext','pageLines',1]])
  $(id).addEventListener('click',()=>{state[key]+=step;render();});
$('buyStockCsv').addEventListener('click',()=>{
  if(!state.meta)return;
  csv('Logistica_compras_cruce_inventario_'+state.cut+'.csv',
    ['Corte','Empresa','Referencia','Material','Unidad','Existencia','Valor inventario ($)',
      'Compradores observados','Última EAC','Estado'],
    filteredStocks().map(r=>[state.cut,r.company,r.ref,r.name,r.unit,r.physical,r.value,
      r.buyers.join(' | '),r.latest,r.status]));
});
$('buyLineCsv').addEventListener('click',()=>{
  if(!state.meta)return;
  csv('Logistica_compras_detalle.csv',
    ['Empresa','Fecha','Tipo','Documento','Factura/referencia','Causación','Referencia','Material',
      'Comprador','Proveedor','Bodega','Unidad','Cantidad','Precio unitario local ($)','Valor bruto local ($)'],
    filteredLines(buyRows()).map(r=>[r.company,r.date,r.kind,r.document,r.invoice,r.causation,
      r.ref,r.name,r.buyer,r.supplier,r.warehouse,r.unit,r.qty,r.price,r.value]));
});
$('page-compras').addEventListener('click',event=>{
  const button=event.target.closest('.buy-drill');if(!button)return;
  const rows=buyRows(),key=button.dataset.key,kind=button.dataset.kind;
  if(kind==='buyer'||kind==='supplier'){
    openPurchaseDetail((kind==='buyer'?'Comprador: ':'Proveedor: ')+button.textContent,
      rows.filter(r=>(metric()==='money'||r.unit==='MT')&&M.identity(r[kind])===key));
  }else if(kind==='month'){
    openPurchaseDetail('Compras '+key,rows.filter(r=>r.date.slice(0,7)===key&&
      (metric()==='money'||r.unit==='MT')));
  }else if(kind==='consumption'){
    const item=state.comparison?.rows.find(r=>r.identity===key);
    if(item)openMovementDetail('Consumo asociado a '+item.name,item.movementRows,
      'CPN − DCN del período comparable. Para ver compras, pulsa la barra verde del gráfico.');
  }
});
$('buyDetailClose').addEventListener('click',()=>$('buyDetail').close());
$('buyDetailMore').addEventListener('click',()=>{if(state.detail){state.detail.limit+=100;renderDetail();}});
$('buyDetail').addEventListener('click',event=>{
  if(event.target===$('buyDetail'))$('buyDetail').close();
});
window.PccLogisticsPurchases={load,render,filterOptions};
})();
