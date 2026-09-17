
(function(){
'use strict';
const M=PccExecutiveModel,storeKey='pcc.executive.commitments.v1';
let current=null,timer,editing=null,tasks=[],storageOK=true;
const $=id=>document.getElementById(id);
const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function button(text,action,primary=false){const b=e('button',text,'gg-button'+(primary?' gg-button-primary':''));b.type='button';b.addEventListener('click',action);return b;}
function format(value,unit){return typeof value!=='number'||!Number.isFinite(value)?'—':new Intl.NumberFormat('es-CO',{maximumFractionDigits:unit==='percent'?1:0,style:unit==='percent'?'percent':'decimal'}).format(value);}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function loadTasks(){try{const parsed=JSON.parse(localStorage.getItem(storeKey)||'[]');if(!Array.isArray(parsed))throw Error();tasks=parsed.map(M.validateTask).filter(Boolean);}catch{storageOK=false;tasks=[];}}
function saveTasks(next){try{localStorage.setItem(storeKey,JSON.stringify(next));tasks=next;storageOK=true;return true;}catch{storageOK=false;message('No se pudo guardar en este navegador. Exporta los compromisos para conservar una copia.');return false;}}
function message(text){$('gg-message').textContent=text;}
function metricNode(m){
 const a=current.areas.find(a=>a.id===m.area),n=e('article',undefined,'gg-metric');
 n.append(e('div',a.name+' · '+m.period,'gg-metric-top'),e('h3',m.title),e('div',format(m.value,m.unit),'gg-value'),e('small',m.note));
 if(m.target!==undefined&&m.value!==null){
   const max=Math.max(1.5,Math.ceil(m.value*2)/2),bar=e('div',undefined,'gg-bullet');bar.setAttribute('aria-hidden','true');
   const fill=e('div',undefined,'gg-bullet-fill');fill.style.width=Math.max(0,Math.min(m.value/max*100,100))+'%';
   const marker=e('div',undefined,'gg-bullet-target');marker.style.left=(m.target/max*100)+'%';bar.append(fill,marker);
   const scale=e('div',undefined,'gg-scale');scale.append(e('span','0%'),e('span','Meta '+format(m.target,'percent')),e('span',format(max,'percent')));n.append(bar,scale);
 }
 n.append(e('small',m.status+' · Referencia: '+a.fresh.label,'gg-source'));return n;
}
function areaNode(a){
 const n=e('article',undefined,'gg-area'+(!a.active?' gg-area-future':'')),header=e('div',undefined,'gg-area-header');
 const status=e('span',a.status,'gg-status');status.dataset.ok=String(a.status==='Vigente');header.append(e('h3',a.name),status);n.append(header);
 if(!a.active){n.append(e('p',a.scope,'gg-caption'),e('p','Se integrará a esta vista cuando su cuadro de mando esté disponible.','gg-caption'));return n;}
 n.append(e('p',a.owner,'gg-caption'),e('p','Referencia: '+a.fresh.label,'gg-caption'));
 if(a.attentionRecords.length){
 const details=e('details'),summary=e('summary','Fuentes que requieren atención ('+a.attentionRecords.length+')');
 details.append(summary);
 const list=e('ul',undefined,'gg-source-list');
 for(const r of a.attentionRecords){const item=e('li');item.append(e('strong',r.label||r.sheet||r.key),e('span',PccFresh.displayState(r)+' · '+PccFresh.referenceLabel(r)),e('span',r.business||'Corte no disponible'));if(r.freshnessBasis==='activity')item.append(e('span','Vigencia según última actividad; módulo en línea.'));else if(r.updated?.basis)item.append(e('span',r.updated.basis));list.append(item);}
 details.append(list);n.append(details);
 }
 n.append(button('Abrir '+a.name,()=>PccExecutiveOpen(a.id)));
 if(a.id==='inv')n.append(button('Consultar histórico',()=>{PccExecutiveOpen('inv');document.getElementById('iframe-inventario')?.contentWindow?.PccInventoryHistoryView?.open();}));return n;
}
function issueNode(issue){
 const n=e('article',undefined,'gg-issue'),area=M.areas.find(a=>a.id===issue.area),copy=e('div'),actions=e('div',undefined,'gg-actions');
 n.append(e('div',(issue.priority<2?'Validar datos':'Revisar resultado')+' · '+area.name,'gg-issue-kind'));
 copy.append(e('h3',issue.title),e('p',issue.action),e('p','Responsable: '+issue.owner,'gg-caption'));
 if(issue.sources?.length){const details=e('details'),summary=e('summary','Ver fuentes afectadas ('+issue.sources.length+')'),list=e('ul');for(const source of issue.sources)list.append(e('li',source.name+' · '+source.basis+': '+source.reference));details.append(summary,list);copy.append(details);}
 actions.append(button('Ver área',()=>PccExecutiveOpen(issue.area)),button('Crear compromiso',()=>openForm(issue)));
 n.append(copy,actions);return n;
}
function render(){
 timer=null;if(!$('page-general'))return;
 current=M.build(PccExecutiveSource(),{data:PccData,fresh:PccFresh});
 $('gg-period-label').textContent=current.label;
 $('gg-metrics').replaceChildren(...current.metrics.map(metricNode));
 const opened=new Set([...$('gg-areas').querySelectorAll('details[open]')].map(d=>d.closest('article').dataset.area));
 $('gg-areas').replaceChildren(...current.areas.map(a=>{const n=areaNode(a);n.dataset.area=a.id;if(opened.has(a.id)&&n.querySelector('details'))n.querySelector('details').open=true;return n;}));
 const list=$('gg-issues'),issues=current.issues;
 list.replaceChildren(...issues.map(issueNode));
 if(!issues.length)list.append(e('p',current.areas.some(a=>a.status==='Consultando')?'Consultando las áreas. Los asuntos aparecerán al completar las cargas.':'Sin alertas para gestionar.','gg-empty'));
 $('gg-issue-count').textContent=issues.length+' alertas';
 if(document.body.dataset.gerencia==='gg')$('liveLbl').textContent=current.areas.some(a=>a.active&&a.status==='Consultando')?'Consultando áreas':'3 áreas integradas';
}
function refresh(){if(!timer)timer=setTimeout(render,120);}
function renderTasks(){
 const list=$('gg-tasks'),filter=$('gg-task-filter').value;
 const shown=tasks.filter(t=>filter==='all'||(filter==='open'?t.status!=='Completado':t.status==='Completado'));
 list.replaceChildren();
 for(const task of shown){
  const card=e('article',undefined,'gg-task'),copy=e('div'),actions=e('div',undefined,'gg-actions'),state=M.taskState(task,today()),badge=e('span',state,'gg-task-status');badge.dataset.overdue=String(state==='Vencido');
  copy.append(badge,e('h3',task.title),e('p',M.areas.find(a=>a.id===task.area).name+' · '+task.owner+' · Fecha: '+task.due.split('-').reverse().join('/'),'gg-caption'));
  if(task.decision)copy.append(e('p',task.decision));
  actions.append(button('Editar',()=>openForm(null,task)));
  if(task.status!=='Completado')actions.append(button('Marcar completado',()=>{const next=tasks.map(t=>t.id===task.id?{...t,status:'Completado'}:t);if(saveTasks(next)){renderTasks();message('Compromiso completado.');}}));
  else actions.append(button('Reabrir',()=>{if(saveTasks(tasks.map(t=>t.id===task.id?{...t,status:'Pendiente'}:t)))renderTasks();}));
  card.append(copy,actions);list.append(card);
 }
 if(!shown.length)list.append(e('p',tasks.length?'No hay compromisos en este estado.':'Aún no hay compromisos. Registra la decisión, el responsable y la fecha acordada.','gg-empty'));
 $('gg-task-count').textContent=tasks.filter(t=>t.status!=='Completado').length+' abiertos · '+tasks.filter(t=>M.taskState(t,today())==='Vencido').length+' vencidos';
}
function openForm(issue,task){
 editing=task?.id||null;const f=$('gg-task-form');f.reset();f.hidden=false;
 $('gg-task-title').value=task?.title||issue?.title||'';
 $('gg-task-area').value=task?.area||issue?.area||'ops';
 $('gg-task-owner').value=task?.owner||issue?.owner||'';
 $('gg-task-decision').value=task?.decision||'';
 $('gg-task-due').value=task?.due||'';
 $('gg-task-status').value=task?.status||'Pendiente';
 $('gg-task-save').textContent=task?'Guardar cambios':'Guardar compromiso';
 f.scrollIntoView({behavior:'instant',block:'center'});$('gg-task-title').focus();
}
function download(name,body){const url=URL.createObjectURL(new Blob([body],{type:'application/json;charset=utf-8'}));const a=e('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function mount(){
 const page=$('page-general');
 page.innerHTML='<header class="gg-heading"><div><div class="gg-eyebrow">Dirección de la empresa · PCC</div><h1 tabindex="-1">Gerencia General</h1><p class="gg-muted">Resultados, asuntos por resolver y compromisos entre áreas.</p></div><div class="gg-period">Operaciones y Costos<strong id="gg-period-label">Consultando período</strong>Inventario: último corte disponible, informado por sus fuentes.</div></header><section aria-labelledby="gg-results-title"><div class="gg-section-head"><div><h2 id="gg-results-title">Lectura ejecutiva</h2><p class="gg-caption">Todas las líneas y módulos disponibles. Las cifras conservan el alcance de su área.</p></div></div><div id="gg-metrics" class="gg-metrics"></div></section><section class="gg-section" aria-labelledby="gg-areas-title"><div class="gg-section-head"><div><h2 id="gg-areas-title">Estado de las áreas</h2><p class="gg-caption">Tres áreas integradas · dos previstas en el mapa de la empresa.</p></div></div><div id="gg-areas" class="gg-area-grid"></div></section><section class="gg-section" aria-labelledby="gg-agenda-title"><div class="gg-section-head"><div><h2 id="gg-agenda-title">Alertas para gestionar</h2><p class="gg-caption">Solo atrasos confirmados, fallos de consulta y desviaciones que requieren una acción.</p></div><span id="gg-issue-count" class="gg-caption"></span></div><div id="gg-issues" class="gg-agenda"></div></section><section class="gg-section" aria-labelledby="gg-tasks-title"><div class="gg-section-head"><div><h2 id="gg-tasks-title">Seguimiento de compromisos</h2><p id="gg-task-count" class="gg-caption"></p></div><div id="gg-task-actions" class="gg-actions"></div></div><p class="gg-caption">Guardados solo en este navegador. No se comparten entre gerentes. Exporta una copia para conservarlos o trasladarlos.</p><p id="gg-message" role="status" aria-live="polite"></p><form id="gg-task-form" class="gg-form" hidden><label class="gg-wide">Compromiso<input id="gg-task-title" maxlength="200" required></label><label>Área<select id="gg-task-area"></select></label><label>Responsable<input id="gg-task-owner" maxlength="100" required></label><label>Fecha acordada<input id="gg-task-due" type="date" required></label><label>Estado<select id="gg-task-status"><option>Pendiente</option><option>En curso</option><option>Completado</option></select></label><label class="gg-wide">Decisión o avance<textarea id="gg-task-decision" rows="3" maxlength="500"></textarea></label><div class="gg-actions gg-wide"><button id="gg-task-save" class="gg-button gg-button-primary" type="submit">Guardar compromiso</button><button id="gg-task-cancel" class="gg-button" type="button">Cancelar</button></div></form><label class="gg-caption" for="gg-task-filter">Mostrar compromisos </label><select id="gg-task-filter" class="gg-button"><option value="open">Abiertos</option><option value="closed">Completados</option><option value="all">Todos</option></select><div id="gg-tasks"></div></section><p class="gg-footnote">Lectura diaria: excepciones. Reunión semanal: coordinación entre áreas. Revisión mensual: resultados y metas. Las fechas faltantes, fuentes incompletas y pendientes de conciliación deben resolverse con cada responsable.</p>';
 for(const a of M.areas.filter(a=>a.active)){const o=e('option',a.name);o.value=a.id;$('gg-task-area').append(o);}
 const importInput=e('input');importInput.type='file';importInput.accept='application/json';importInput.hidden=true;
 $('gg-task-actions').append(button('Nuevo compromiso',()=>openForm(),true),button('Exportar',()=>download('compromisos-pcc-'+today()+'.json',JSON.stringify({version:1,tasks},null,2))),button('Importar',()=>importInput.click()),importInput);
 importInput.addEventListener('change',async()=>{
  try{
   const file=importInput.files[0];if(!file)return;if(file.size>1000000)throw Error('El archivo supera 1 MB.');
   const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.tasks)||data.tasks.length>1000)throw Error('Formato de archivo no válido.');
   const imported=data.tasks.map(M.validateTask);if(imported.some(t=>!t))throw Error('Hay compromisos con campos inválidos.');
   const ids=new Set(tasks.map(t=>t.id)),added=imported.filter(t=>{if(ids.has(t.id))return false;ids.add(t.id);return true;});
   if(saveTasks([...tasks,...added])){renderTasks();message(added.length+' compromisos importados. Los ya existentes se conservaron.');}
  }catch(error){message('No se importó el archivo: '+error.message);}finally{importInput.value='';}
 });
 $('gg-task-cancel').addEventListener('click',()=>{$('gg-task-form').hidden=true;});
 $('gg-task-filter').addEventListener('change',renderTasks);
 $('gg-task-form').addEventListener('submit',ev=>{
  ev.preventDefault();const task=M.validateTask({id:editing||crypto.randomUUID(),title:$('gg-task-title').value,area:$('gg-task-area').value,owner:$('gg-task-owner').value,due:$('gg-task-due').value,status:$('gg-task-status').value,decision:$('gg-task-decision').value});
  if(!task){message('Revisa el compromiso, responsable y fecha.');return;}
  const next=editing?tasks.map(t=>t.id===editing?task:t):[...tasks,task];
  if(saveTasks(next)){$('gg-task-form').hidden=true;renderTasks();message('Compromiso guardado en este navegador.');}
 });
 window.addEventListener('storage',ev=>{if(ev.key===storeKey){loadTasks();renderTasks();}});
 loadTasks();renderTasks();if(!storageOK)message('No se pudieron leer los compromisos guardados. Exporta una copia antes de cambiar de navegador.');
 if(window.PCC_REVIEW)$('gg-period-label').after(e('small','Comparación local: datos capturados; Actualizar relee la captura.','gg-caption'));
 render();
}
window.PccExecutive={refresh};
mount();
switchGerencia(['gg','ops','cos','inv'].includes(location.hash.slice(1))?location.hash.slice(1):'gg',null,true);
window.addEventListener('hashchange',()=>{const area=location.hash.slice(1);switchGerencia(['gg','ops','cos','inv'].includes(area)?area:'gg',null,true);});
})();
