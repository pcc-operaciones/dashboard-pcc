(function(root){
  'use strict';
  const areas=[{id:'ops',name:'Operaciones',owner:'Gerencia de Operaciones',active:true},{id:'cos',name:'Costos',owner:'Gerencia de Costos',active:true},{id:'inv',name:'Inventario PT',owner:'Gerencia de Inventario',active:true},{id:'log',name:'Logística',owner:'Gerencia de Logística',active:false,scope:'Telas e insumos · compras y abastecimiento'},{id:'sales',name:'Ventas',owner:'Gerencia de Ventas',active:false,scope:'Clientes, pedidos y cumplimiento comercial'}];
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  function period(config){const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];const m=months.indexOf(String(config?.mes||'').toLowerCase());return m<0||!/^20\d{2}$/.test(String(config?.año))?null:config.año+'-'+String(m+1).padStart(2,'0');}
  function costSummary(rows,key){const selected=key?rows.filter(r=>r.fecha===key):[],valid=selected.filter(r=>finite(r.rent));return {count:selected.length,rent:valid.length?valid.reduce((s,r)=>s+r.rent,0)/valid.length:null,negative:valid.length?valid.filter(r=>r.rent<0).length:null,missing:selected.length-valid.length};}
  function inventorySummary(rows){const selected=rows.filter(r=>!r.esSeg&&!r.esCobros);if(!selected.length)return {units:null,aged:null,agedShare:null};const units=selected.reduce((s,r)=>s+['u0','u1','u2','u3'].reduce((n,k)=>n+(finite(r[k])?r[k]:0),0),0),aged=selected.reduce((s,r)=>s+(finite(r.u3)?r.u3:0),0);return {units,aged,agedShare:units>0?aged/units:null};}
  function build(input,deps){
    const key=period(input.config),label=key?input.config.mes+' '+input.config.año:'Período no configurado';
    const result={key,label,areas:[],metrics:[],issues:[]};
    const issue=(area,id,title,action,priority=2)=>result.issues.push({area,id,title,action,priority,owner:areas.find(a=>a.id===area).owner});
    for(const area of areas){
      if(!area.active){result.areas.push({...area,status:'Por incorporar'});continue;}
      const source=input[area.id]||{},records=source.records||[],fresh=deps.fresh.summary(records);
      const ready=source.status==='ready'&&(area.id==='inv'||!!key);
      const status=!key&&area.id!=='inv'?'Período no configurado':source.status==='loading'||!source.status?'Consultando':source.status==='error'?'No disponible':source.status==='empty'?'Sin registros':fresh.status;
      const a={...area,status,fresh,records,ready};result.areas.push(a);
      if(source.status==='error')issue(area.id,area.id+'-error','No se pudo actualizar '+area.name,'Reintentar la consulta y revisar el acceso a las fuentes.',0);
      else if(ready&&fresh.status!=='Vigente'&&fresh.status!=='Sin actividad registrada')issue(area.id,area.id+'-fresh',area.name+': '+fresh.status.toLowerCase(),'Confirmar actualización, cobertura y corte con el responsable de las fuentes.',1);
      const metric=(id,title,value,unit,note,target)=>result.metrics.push({id,area:area.id,title,value:ready?value:null,unit,note,target,status,period:area.id==='inv'?'Último inventario disponible':label});
      if(area.id==='ops'){
        const mods=source.mods||[],ef=mods.length?deps.data.ops(mods,'ef'):null,compliance=mods.length?deps.data.ops(mods,'cumpl'):null;
        metric('efficiency','Eficiencia de producción',ef,'percent','Ponderada por tiempos · excluye Servicios',.75);
        metric('compliance','Cumplimiento de producción',compliance,'percent','Producción / meta de los módulos con datos',1);
        if(ready&&finite(compliance)&&compliance<1)issue('ops','ops-plan','Producción por debajo de la meta','Revisar módulos con desviación y acordar el plan de recuperación.');
        if(ready&&finite(ef)&&ef<.75)issue('ops','ops-efficiency','Eficiencia por debajo de 75%','Revisar capacidad, tiempos improductivos y prioridades del plan.');
      }
      if(area.id==='cos'){
        const c=costSummary(source.rows||[],key);a.count=c.count;
        metric('cost-rent','Rentabilidad de costeos',c.rent,'percent','Promedio por registro; no es margen real de ventas');
        metric('cost-negative','Costeos con rentabilidad negativa',c.negative,'number',c.count+' registros del mes · '+c.missing+' sin rentabilidad');
        if(ready&&c.negative>0)issue('cos','cos-negative',c.negative+' costeos con rentabilidad negativa','Conciliar costo y precio por referencia antes de acordar ajustes.');
        if(ready&&!c.count)issue('cos','cos-empty','Sin costeos para '+label,'Confirmar el período y la carga de costeos con el área.',1);
      }
      if(area.id==='inv'){
        const inv=inventorySummary(source.rows||[]);a.inventory=inv;
        metric('inventory-units','Existencias de producto terminado',inv.units,'number','Unidades · excluye Segundas y Cobros');
        metric('inventory-aged','Unidades con más de 90 días',inv.aged,'number',finite(inv.agedShare)?(inv.agedShare*100).toFixed(1)+'% de las existencias · edad según fuente':'Edad según fuente');
        if(ready&&inv.aged>0)issue('inv','inv-aged','Inventario con más de 90 días','Revisar referencias y definir prioridades de salida con el área comercial.');
      }
    }
    result.issues.sort((a,b)=>a.priority-b.priority);
    return result;
  }
  const states=['Pendiente','En curso','Completado'];
  function validateTask(value){const task={};for(const [k,max]of [['id',80],['title',200],['owner',100],['decision',500],['area',10],['due',10],['status',20]])task[k]=String(value?.[k]??'').trim().slice(0,max);if(!task.id||!task.title||!task.owner||!areas.some(a=>a.id===task.area&&a.active)||!states.includes(task.status)||!/^\d{4}-\d{2}-\d{2}$/.test(task.due))return null;const date=new Date(task.due+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==task.due)return null;return task;}
  function taskState(task,today){return task.status!=='Completado'&&task.due<today?'Vencido':task.status;}
  const api={areas,period,costSummary,inventorySummary,build,validateTask,taskState,states};root.PccExecutiveModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
