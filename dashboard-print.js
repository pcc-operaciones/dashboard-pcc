/* Exporta la vista activa con sus tablas y gráficos, usando Guardar como PDF del navegador. */
(function(){
 'use strict';
 async function printView(source,title,scope=''){
  if(!source||document.getElementById('pcc-print-frame'))return;
  const owner=source.ownerDocument;
  const frame=document.createElement('iframe');
  frame.id='pcc-print-frame';
  frame.title='Vista de impresión';
  frame.style.cssText='position:fixed;left:-1600px;top:0;width:1200px;height:800px;border:0';
  document.body.append(frame);
  try{
   const doc=frame.contentDocument;
   doc.documentElement.lang='es';
   doc.title=title;
   if(owner.body.dataset.area)doc.body.dataset.area=owner.body.dataset.area;
   const base=doc.createElement('base');base.href=owner.baseURI;doc.head.append(base);
   const css=[...owner.querySelectorAll('head style,head link[rel=stylesheet]')];
   const loaded=css.map(node=>{
    const copy=doc.importNode(node,true);
    const ready=copy.tagName==='LINK'?new Promise(resolve=>{
     copy.onload=copy.onerror=resolve;
    }):Promise.resolve();
    doc.head.append(copy);
    return ready;
   });
   const style=doc.createElement('style');
   style.textContent=`
    @page{size:A4 landscape;margin:12mm}
    html,body{background:white!important;color:#1b3a5c!important;font-family:"DM Sans",Arial,sans-serif;overflow:visible!important}
    .pcc-print-header{padding:0 0 10px;border-bottom:2px solid #0d6b5e;margin-bottom:10px}
    .pcc-print-header h1{font-size:20px;margin:0 0 4px}.pcc-print-header p{font-size:11px;margin:0 0 4px}
    .pcc-print-view,.pcc-print-view .ax-app,.pcc-print-view .ax-main{display:block!important;width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;position:static!important;background:white!important;color:#1b3a5c!important;padding:0!important}
    .pcc-print-view .ax-filter-scope,.pcc-print-view .ax-modal-scope,.pcc-print-view .ax-footer{color:#1b3a5c!important}
    .pcc-print-view .ax-area-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:none!important}
    .pcc-print-view .ax-area-card{min-height:0!important;height:auto!important;border:1px solid #d6e0ea;break-inside:avoid}
    .pcc-print-view .ax-area-charts{contain:none!important;min-height:0!important}
    .pcc-print-view .ax-area-charts .atlas-chart{height:auto!important}
    .pcc-print-view :is(.atlas-large-chart,.ax-record-scroll,.tw,.scroll,.hist-scroll,.ax-dialog,.atlas-stage-data){height:auto!important;max-height:none!important;overflow:visible!important}
    .pcc-print-view :is(.atlas-cost-table,.atlas-variation-table,table){width:100%!important;min-width:0!important;font-size:9px!important}
    .pcc-print-view :is(td,th){white-space:normal!important;overflow-wrap:anywhere;position:static!important;min-width:0!important}
    .pcc-print-view thead{display:table-header-group}.pcc-print-view tr{break-inside:avoid}
    .pcc-print-view img[data-chart-image]{display:block;width:auto;max-width:100%;max-height:110mm;object-fit:contain}
    .pcc-print-view :is(button,input,select,.ax-global-filters,.ax-modal-controls,.atlas-pagination,.ax-tile-foot,.ax-heading,.ax-expand,.filter-bar,.pager){display:none!important}
    .pcc-print-view [data-print-label]{display:inline!important;background:none!important;padding:0!important}
    .pcc-print-view .ax-kpi[data-print-label]{display:block!important}
    .pcc-print-view .ax-area-heading[data-print-label],.pcc-print-view .ax-chart-button[data-print-label]{display:block!important}
    .pcc-print-view[data-detail-view]{margin:0!important;border:0!important;box-shadow:none!important;max-height:none!important;overflow:visible!important}
    .pcc-print-view .pcc-print-expanded{max-height:none!important;overflow:visible!important;height:auto!important}
    .pcc-print-view .ax-modal-head{display:none!important}
   `;
   doc.head.append(style);
   const header=doc.createElement('header');header.className='pcc-print-header';
   const heading=doc.createElement('h1');heading.textContent=title;header.append(heading);
   for(const label of [scope,'Generado el '+new Date().toLocaleString('es-CO',{timeZone:'America/Bogota'})].filter(Boolean)){
    const line=doc.createElement('p');line.textContent=label;header.append(line);
   }
   const copy=doc.importNode(source,true);
   copy.classList.add('pcc-print-view');
   copy.classList.remove('page','print-target');
   copy.hidden=false;
   // Cada gráfico se imprime con el tamaño y las series que muestra la vista.
   const canvases=[...source.querySelectorAll('canvas')];
   copy.querySelectorAll('canvas').forEach((node,i)=>{
    const canvas=canvases[i];
    if(!canvas.width||!canvas.height){node.remove();return;}
    const img=doc.createElement('img');
    img.src=canvas.toDataURL();img.alt=canvas.getAttribute('aria-label')||'Gráfico';
    img.dataset.chartImage='';
    node.replaceWith(img);
   });
   copy.querySelectorAll('script,iframe,[hidden]').forEach(node=>node.remove());
   copy.querySelectorAll('table').forEach(table=>{
    for(let container=table.parentElement;container&&container!==copy;container=container.parentElement){
     const maxHeight=container.style.maxHeight;
     if(maxHeight&&maxHeight!=='none')container.classList.add('pcc-print-expanded');
    }
   });
   copy.querySelectorAll('[onclick],[onchange]').forEach(node=>{
    node.removeAttribute('onclick');node.removeAttribute('onchange');
   });
   copy.querySelectorAll('button').forEach(button=>{
    if(!button.matches('.ax-kpi,.ax-area-heading,.ax-chart-button,.ax-ref-link,.ax-series-button,[data-state],[data-record]'))return;
    const label=doc.createElement('span');
    label.className=button.className;label.dataset.printLabel='';
    label.append(...button.childNodes);button.replaceWith(label);
   });
   copy.querySelectorAll('details').forEach(node=>{node.open=true;});
   doc.body.append(header);
   if(source.id!=='pcc-atlas'&&source.closest('#pcc-atlas')){
    const atlas=doc.createElement('div');atlas.id='pcc-atlas';atlas.append(copy);doc.body.append(atlas);
   }else doc.body.append(copy);
   await Promise.race([Promise.allSettled(loaded),new Promise(resolve=>setTimeout(resolve,1800))]);
   await Promise.allSettled([...doc.images].map(img=>img.decode()));
   const view=frame.contentWindow;
   view.addEventListener('afterprint',()=>frame.remove(),{once:true});
   view.focus();
   view.print();
  }catch(error){
   frame.remove();
   console.error('Error al preparar el PDF:',error);
   alert('No se pudo preparar el PDF de esta vista. Intenta de nuevo.');
  }
 }
 window.PccPrintView=printView;
})();
