(()=>{'use strict';
const tables=[...document.querySelectorAll('.page table')];
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const date=()=>new Date().toISOString().slice(0,10);
const visible=row=>!row.hidden&&getComputedStyle(row).display!=='none';
const text=cell=>cell?.innerText.trim().replace(/\s+/g,' ')||'';
const slug=value=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,45);
const numeric=(value,heading)=>{
  if(/referencia|documento|bodega|empresa|mes|fecha|estado|unidad|material|proveedor|comprador/i.test(heading))return value;
  const clean=value.replace(/^\$\s*/,'').replace(/\s*(MT|UND|KG|MTS|M2|%)$/i,'').trim();
  if(!/^-?[\d.]+(?:,\d+)?$/.test(clean))return value;
  const number=Number(clean.replace(/\./g,'').replace(',','.'));
  return Number.isFinite(number)?(value.includes('%')?number/100:number):value;
};
function scope(){
  const company=document.getElementById('company')?.selectedOptions[0]?.textContent||'Todas';
  const area=document.querySelector('.area-btn.active')?.textContent.trim()||'Logística';
  const cut=document.getElementById('headerCut')?.textContent.trim()||'';
  return {company,area,cut};
}
function enhance(table,index){
  const tbody=table.tBodies[0],head=table.tHead?.rows[0];
  if(!tbody||!head)return;
  const headers=[...head.cells].map(cell=>text(cell).replace(/\s*▾$/,'')),card=table.closest('.chart-card'),dialog=table.closest('dialog');
  if(!card&&!dialog)return;
  const title=card?.querySelector('.cc-hdr h2,.table-tools h2')?.textContent.trim()||
    dialog?.querySelector('.dialog-heading h2')?.textContent.trim()||headers.slice(0,2).join(' · ');
  const paginated=!!card?.querySelector('.pager');
  const selected=new Set(),filters=new Map();let sort=null;
  const toolbar=document.createElement('div');toolbar.className='log-table-actions';
  const info=document.createElement('span');info.className='log-export-count';
  const all=document.createElement('button');all.type='button';all.textContent='Seleccionar visibles';
  const clear=document.createElement('button');clear.type='button';clear.textContent='Limpiar selección';
  const excel=document.createElement('button');excel.type='button';excel.className='log-export-excel';excel.textContent='⬇ Excel';
  const pdf=document.createElement('button');pdf.type='button';pdf.className='log-export-pdf';pdf.textContent='📄 PDF';
  toolbar.append(info,all,clear,excel,pdf);
  const scroll=table.closest('.scroll');scroll?.before(toolbar);
  function rows(){return [...tbody.rows].filter(row=>row.cells.length===headers.length)}
  function shown(){return rows().filter(visible)}
  function chosen(){const active=shown().filter(row=>selected.has(row));return active.length?active:shown()}
  function selectionActive(){return shown().some(row=>selected.has(row))}
  function update(){
    for(const row of rows()){
      if(!row.hasAttribute('tabindex'))row.tabIndex=0;
      row.classList.toggle('log-row-selected',selected.has(row));
      row.setAttribute('aria-selected',String(selected.has(row)));
    }
    for(const row of [...selected])if(!row.isConnected)selected.delete(row);
    info.textContent=shown().length+' visibles'+(selected.size?' · '+selected.size+' seleccionadas':'')+(paginated?' · página actual':'');
  }
  function apply(){
    for(const row of rows())row.hidden=[...filters].some(([column,values])=>!values.has(text(row.cells[column])));
    if(sort){
      const ordered=rows().sort((a,b)=>{
        const x=text(a.cells[sort.column]),y=text(b.cells[sort.column]);
        return sort.direction*(x.localeCompare(y,'es',{numeric:true}));
      });
      if(ordered.some((row,i)=>row!==rows()[i])){
        const fragment=document.createDocumentFragment();ordered.forEach(row=>fragment.append(row));tbody.append(fragment);
      }
    }
    update();
  }
  tbody.addEventListener('click',event=>{
    if(event.target.closest('button,a,input,select,label'))return;
    const row=event.target.closest('tr');if(!row||!visible(row)||row.cells.length!==headers.length)return;
    selected.has(row)?selected.delete(row):selected.add(row);update();
  });
  tbody.addEventListener('keydown',event=>{
    if(event.target.tagName!=='TR'||!['Enter',' '].includes(event.key))return;
    event.preventDefault();const row=event.target;
    selected.has(row)?selected.delete(row):selected.add(row);update();
  });
  all.addEventListener('click',()=>{shown().forEach(row=>selected.add(row));update()});
  clear.addEventListener('click',()=>{selected.clear();update()});
  // Las tablas con filtro de origen ya disponen de su propio menú por columna.
  if(!head.querySelector('.log-col-button')){
    [...head.cells].forEach((cell,column)=>{
      const button=document.createElement('button');button.type='button';button.className='log-column-trigger';
      button.textContent='▾';button.title='Filtrar u ordenar '+headers[column];
      button.setAttribute('aria-label','Filtrar u ordenar '+headers[column]);cell.append(button);
      button.addEventListener('click',event=>{
        event.stopPropagation();document.querySelector('.log-export-panel')?.remove();
        const panel=document.createElement('div');panel.className='log-col-panel log-export-panel';
        panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Filtrar '+headers[column]);
        const heading=document.createElement('strong');heading.textContent=headers[column];panel.append(heading);
        const orders=document.createElement('div');orders.className='log-col-orders';
        for(const [direction,label] of [[1,'↑ Ascendente'],[-1,'↓ Descendente']]){
          const btn=document.createElement('button');btn.type='button';btn.textContent=label;
          btn.onclick=()=>{sort={column,direction};panel.remove();apply()};orders.append(btn);
        }panel.append(orders);
        const options=document.createElement('div');options.className='log-col-values';
        const values=[...new Set(rows().map(row=>text(row.cells[column])))].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
        const prior=filters.get(column);
        for(const value of values){const item=document.createElement('label'),input=document.createElement('input');
          input.type='checkbox';input.value=value;input.checked=!prior||prior.has(value);
          item.append(input,document.createTextNode(value||'Sin dato'));options.append(item)}
        panel.append(options);
        const actions=document.createElement('div');actions.className='log-col-actions';
        for(const [label,action] of [['Todas',()=>options.querySelectorAll('input').forEach(i=>i.checked=true)],
          ['Ninguna',()=>options.querySelectorAll('input').forEach(i=>i.checked=false)],
          ['Aplicar',()=>{const values=new Set([...options.querySelectorAll('input:checked')].map(i=>i.value));
            if(values.size===options.querySelectorAll('input').length)filters.delete(column);else filters.set(column,values);
            panel.remove();apply()}]]){
          const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.onclick=action;actions.append(btn);
        }panel.append(actions);document.body.append(panel);
        const rect=button.getBoundingClientRect();
        panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-268))+'px';
        panel.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-panel.offsetHeight-8))+'px';
      });
    });
  }
  function data(){return {head:headers,body:chosen().map(row=>[...row.cells].map(text))}}
  function metadata(mode){const s=scope();return [
    ['Informe',title],['Generado',new Date().toLocaleString('es-CO')],['Proceso',s.area],
    ['Empresa',s.company],['Corte',s.cut],['Alcance',mode],['Registros exportados',chosen().length]
  ]}
  excel.onclick=()=>{
    const lib=window.XLSX||window.parent?.XLSX;
    if(!lib){alert('No se pudo cargar la librería Excel. Recarga e intenta de nuevo.');return}
    const d=data(),mode=selectionActive()?'Filas seleccionadas':'Filas visibles'+(paginated?' de la página actual':'');
    const body=d.body.map(row=>row.map((value,i)=>numeric(value,d.head[i])));
    const sheet=lib.utils.aoa_to_sheet([...metadata(mode),[],d.head,...body]);
    const book=lib.utils.book_new();lib.utils.book_append_sheet(book,sheet,'Datos');
    lib.writeFile(book,'logistica_'+slug(title)+'_'+date()+'.xlsx');
  };
  pdf.onclick=()=>{
    const d=data(),mode=selectionActive()?'Filas seleccionadas':'Filas visibles'+(paginated?' de la página actual':'');
    const win=window.open('','_blank','width=1000,height=700');
    if(!win){alert('Permite las ventanas emergentes para exportar el PDF.');return}
    const meta=metadata(mode).map(([key,value])=>'<span><b>'+escape(key)+':</b> '+escape(value)+'</span>').join('');
    const tableHtml='<table><thead><tr>'+d.head.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+
      d.body.map(row=>'<tr>'+row.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    win.document.write('<!doctype html><html lang="es"><meta charset="utf-8"><title>'+escape(title)+'</title><style>'+
      'body{font:11px Arial,sans-serif;color:#1C2833;margin:18px}h1{font-size:17px;color:#1B3A5C}.meta{display:flex;flex-wrap:wrap;gap:7px 20px;margin:10px 0 16px;color:#52677C}table{border-collapse:collapse;width:100%}th{background:#1B3A5C;color:white;text-align:left}th,td{padding:6px;border-bottom:1px solid #E2E8F0}tr:nth-child(even){background:#F8FAFC}@page{size:A4 landscape;margin:1cm}'+'</style><h1>'+escape(title)+'</h1><div class="meta">'+meta+'</div>'+tableHtml+'</html>');
    win.document.close();win.focus();setTimeout(()=>{win.print();win.close()},500);
  };
  new MutationObserver(()=>{selected.forEach(row=>{if(!row.isConnected)selected.delete(row)});apply()})
    .observe(tbody,{childList:true});
  update();
}
tables.forEach(enhance);
document.getElementById('printPage').addEventListener('click',()=>{
  const area=document.querySelector('.area-btn.active')?.textContent.trim()||'Logística';
  const pane=document.querySelector('.page.active h1')?.textContent.trim()||'Resumen';
  const original=document.title;document.title='CMI · '+area+' · '+pane;
  window.print();document.title=original;
});
document.addEventListener('pointerdown',event=>{
  const panel=document.querySelector('.log-export-panel');
  if(panel&&!panel.contains(event.target)&&!event.target.closest('.log-column-trigger'))panel.remove();
});
})();
