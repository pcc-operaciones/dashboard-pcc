
const {test}=require('node:test');
const assert=require('node:assert/strict');
const f=require('../source-freshness.js');
const now=new Date('2026-09-14T15:00:00Z');
const meta={group:'inv',sheet:'INV_Movimientos'};
function rec(rows){return {...meta,state:'ok',...f.inspect(rows,meta,now)};}
test('fechas estrictas: ISO, colombiana y zona horaria explícita',()=>{
 assert.equal(f.parseDate('2026-07-10 20:03').label,'10/07/2026 20:03');
 assert.equal(f.parseDate('10/07/2026 20:03').key,'2026-07-10 20:03');
 assert.equal(f.parseDate('2026-09-14T02:00:00Z').date,'2026-09-13');
 assert.equal(f.parseDate('2026-02-30'),null);
 assert.equal(f.parseDate('2026'),null);
 assert.equal(f.parseDate('2026-01-01 24:00'),null);
});
test('fecha futura o inválida no certifica actualización',()=>{
 const r=rec([['Fecha_Actualizacion'],['2026-12-01'],['malformada']]);
 assert.equal(r.updated.invalid,2);
 assert.equal(f.state(r,now),'Fecha no disponible');
});
test('costeo y actualización de fuente son conceptos separados',()=>{
 const r=f.inspect([['FECHA COSTEO','FECHA CIERRE'],['2026-09-12','2026-09-13']],{group:'cos'},now);
 assert.equal(r.updated.first,null);
 assert.match(r.business,/12\/09\/2026/);
});
test('mes de movimientos no se presenta como corte certificado',()=>{
 const r=rec([['Año','Mes','Fecha_Actualizacion'],['2026','7','2026-07-10 20:03']]);
 assert.equal(r.updated.last.date,'2026-07-10');
 assert.equal(r.cutoff.last,null);
 assert.match(r.business,/mes final posiblemente parcial/);
 assert.equal(f.state(r,now),'Atrasado');
});
test('corte y actualización se leen de campos independientes',()=>{
 const r=rec([['DATOS_HASTA','FECHA_ACTUALIZACION'],['2026-09-10','2026-09-14 08:00']]);
 assert.equal(r.cutoff.last.date,'2026-09-10');
 assert.equal(r.updated.last.date,'2026-09-14');
});
test('fuentes con fechas distintas no se resumen solo con la más reciente',()=>{
 const s=f.summary([rec([['Fecha_Actualizacion'],['2026-07-10']]),rec([['Fecha_Actualizacion'],['2026-09-14']])],now);
 assert.equal(s.status,'Hay fuentes atrasadas');
 assert.equal(s.different,true);
 assert.match(s.label,/10\/07\/2026/);assert.match(s.label,/14\/09\/2026/);
});
test('una fuente sin fecha evita certificar el frente completo',()=>{
 const s=f.summary([rec([['Fecha_Actualizacion'],['2026-09-14']]),rec([['Referencia'],['ABC']])],now);
 assert.equal(s.status,'Fechas por confirmar');assert.equal(s.unknown,1);
});
test('fechas faltantes en filas no se ocultan detrás de una fecha válida',()=>{
 const r=rec([['Referencia','Fecha_Actualizacion'],['A','2026-09-14'],['B','']]);
 assert.equal(r.updated.missing,1);
 assert.equal(f.state(r,now),'Fecha incompleta');
});
test('metadatos pueden venir como etiqueta y valor',()=>{
 const r=rec([['FECHA_ACTUALIZACION_FUENTE','2026-09-14 07:00'],['DATOS_HASTA','2026-09-13']]);
 assert.equal(r.updated.last.date,'2026-09-14');
 assert.equal(r.cutoff.last.date,'2026-09-13');
});
test('refresh no cambia fecha de origen; error conserva la última fecha con aviso',()=>{
 f.track('test',[['Fecha_Actualizacion'],['2026-07-10 20:03']],'ok',meta);
 const stamp=f.records.get('test').updated.last.key;
 f.track('test',[],'loading',meta);assert.equal(f.records.get('test').updated.last.key,stamp);
 f.track('test',[],'error',meta);assert.equal(f.state(f.records.get('test'),now),'Error de consulta');
 assert.equal(f.records.get('test').updated.last.key,stamp);
 f.track('test',[['Referencia'],['ABC']],'ok',meta);assert.equal(f.records.get('test').updated.first,null);
 f.records.delete('test');
});
test('los umbrales se configuran por frente',()=>{
 f.configure({maxDiasSinActualizar:{inv:5}});
 assert.equal(f.state(rec([['Fecha_Actualizacion'],['2026-09-10']]),now),'Vigente');
 f.configure({maxDiasSinActualizar:{inv:1}});
 assert.equal(f.state(rec([['Fecha_Actualizacion'],['2026-09-10']]),now),'Atrasado');
});
test('no se infieren timestamps a partir de campos FECHA ambiguos',()=>{
 assert.equal(rec([['FECHA','AÑO'],['2026-09-14','2026']]).updated.first,null);
});
test('fecha de reporte de alertas se conserva sin certificar actualización',()=>{
 const r=f.inspect([['FECHA'],['2026-09-14']],{group:'ops',sheet:'KPI_ALERTAS'},now);
 assert.equal(r.updated.first,null);assert.match(r.business,/Fecha del reporte de alertas: 14\/09\/2026/);
});

test('fechas colombianas sin ceros iniciales mantienen validación de calendario',()=>{
 assert.equal(f.parseDate('8/9/2026').key,'2026-09-08');
 assert.equal(f.parseDate('8/09/2026').label,'08/09/2026');
 assert.equal(f.parseDate('31/2/2026'),null);
});
test('última OP identifica generación y carga del informe en ambas hojas y frentes',()=>{
 for(const sheet of ['EU_Lotes','TEX_Lotes'])for(const group of ['ops','inv']){
  const r={group,state:'ok',...f.inspect([['F_Programacion'],['22/03/2024'],['8/09/2026'],['7/09/2026']],{group,sheet},now)};
  assert.equal(r.updated.first.key,'2026-09-08');assert.equal(r.updated.last.key,'2026-09-08');
  assert.match(r.updated.basis,/última OP creada/);assert.equal(r.cutoff.first,null);
  assert.equal(f.summary([r],now).different,false);
 }
});
test('regla de OP no oculta fechas inválidas, futuras o faltantes',()=>{
 const r={group:'ops',state:'ok',...f.inspect([['OP','F_Programacion'],['A','14/09/2026'],['B',''],['C','31/02/2026'],['D','30/09/2026']],{sheet:'EU_Lotes'},now)};
 assert.equal(r.updated.last.key,'2026-09-14');assert.equal(r.updated.invalid,2);assert.equal(r.updated.missing,1);
 assert.equal(f.state(r,now),'Fecha incompleta');
 const empty=f.inspect([['F_Programacion'],['malformada']],{sheet:'TEX_Lotes'},now);
 assert.equal(empty.updated.first,null);
});
test('regla de última OP es exclusiva y respeta metadatos explícitos',()=>{
 const rows=[['F_Programacion','FECHA_ACTUALIZACION'],['14/09/2026','10/09/2026']];
 assert.equal(f.inspect(rows,{sheet:'EU_Lotes'},now).updated.last.key,'2026-09-10');
 assert.equal(f.inspect([['F_Programacion'],['14/09/2026']],{sheet:'Otra_hoja'},now).updated.first,null);
 const explicitMissing=f.inspect([['F_Programacion','FECHA_ACTUALIZACION'],['14/09/2026','']],{sheet:'EU_Lotes'},now);
 assert.equal(explicitMissing.updated.first,null);
});

test('última actividad excluye filas que solo tienen metas o minutos teóricos',()=>{
 const report=f.operationalReport([{dia:14,pro:186,real:2755,ing:1223202},{dia:15,pro:0,real:0,ing:0,teo:576,um:100}],{mes:'Septiembre',año:'2026'},new Date('2026-09-15T15:00:00Z'));
 assert.equal(report.reportedThrough.key,'2026-09-14');
 assert.equal(report.business,'Actividad registrada hasta: 14/09/2026');
});
test('actividad valida calendario, período y fechas futuras en Colombia',()=>{
 const config={mes:'Febrero',año:2026};
 assert.equal(f.operationalReport([{dia:29,pro:1},{dia:28,real:1}],config,now).reportedThrough.date,'2026-02-28');
 assert.equal(f.operationalReport([{dia:15,pro:1}],{mes:'Septiembre',año:2026},now).reportedThrough,null);
 assert.equal(f.operationalReport([{dia:14,pro:1}],null,now).reportedThrough,null);
 assert.equal(f.operationalReport([{dia:14.5,pro:1}],{mes:'Septiembre',año:2026},now).reportedThrough,null);
});
test('vigencia por actividad no inventa una fecha de carga ni oculta fallos',()=>{
 const r={group:'ops',state:'ok',...f.inspect([['Día'],[14]],{group:'ops'},now),...f.operationalReport([{dia:14,real:10}],{mes:'Septiembre',año:2026},now)};
 assert.equal(f.displayState(r,now),'Actividad al día');
 assert.equal(r.updated.first,null);
 assert.equal(f.summary([r],now).status,'Vigente');
 assert.equal(f.displayState({...r,state:'error'},now),'Error de consulta');
 assert.equal(f.displayState({...r,state:'loading'},now),'Consultando');
 assert.equal(f.displayState({...r,reportedThrough:null},now),'Sin actividad registrada');
});
test('una carga exitosa sin actividad no conserva el día reportado anterior',()=>{
 const m={group:'ops',sheet:'EF MOD2'};
 f.track('activity-test',[['Día'],[14]],'ok',m);
 f.detail('activity-test',f.operationalReport([{dia:14,pro:10}],{mes:'Septiembre',año:2026},now));
 assert.equal(f.records.get('activity-test').reportedThrough.date,'2026-09-14');
 f.track('activity-test',[['Día'],[15]],'ok',m);
 assert.equal(f.records.get('activity-test').reportedThrough,null);
 f.records.delete('activity-test');
});

test('módulos en línea alertan al superar el umbral de actividad, no antes',()=>{
 const current=new Date('2026-09-15T15:00:00Z');
 const make=day=>({group:'ops',state:'ok',...f.operationalReport([{dia:day,pro:1}],{mes:'Septiembre',año:2026},current)});
 assert.equal(f.displayState(make(14),current),'Actividad al día');
 assert.equal(f.displayState(make(13),current),'Actividad al día');
 assert.equal(f.displayState(make(12),current),'Actividad atrasada');
 assert.equal(f.summary([make(14)],current).unknown,0);
 assert.equal(f.summary([make(14)],current).status,'Vigente');
 f.configure({maxDiasSinActualizar:{ops:1}});
 assert.equal(f.displayState(make(13),current),'Actividad atrasada');
 f.configure({maxDiasSinActualizar:{ops:2}});
});
test('timestamp de carga no altera vigencia de un módulo en línea',()=>{
 const r={group:'ops',state:'ok',...f.inspect([['FECHA_ACTUALIZACION'],['2026-07-10']],{group:'ops'},now),...f.operationalReport([{dia:14,real:1}],{mes:'Septiembre',año:2026},now)};
 assert.equal(f.state(r,now),'Vigente');assert.equal(f.referenceLabel(r),'14/09/2026');
 assert.equal(r.updated.first.key,'2026-07-10');
 assert.equal(f.summary([r],now).label,'14/09/2026');
});
test('informe atrasado no se oculta al convivir con módulos al día',()=>{
 const module={group:'ops',state:'ok',...f.operationalReport([{dia:14,pro:1}],{mes:'Septiembre',año:2026},now)};
 const report={group:'ops',state:'ok',...f.inspect([['F_Programacion'],['04/09/2026']],{sheet:'EU_Lotes',group:'ops'},now)};
 const s=f.summary([module,report],now);
 assert.equal(s.status,'Hay fuentes atrasadas');assert.equal(s.unknown,0);
 assert.equal(s.label,'04/09/2026 — 14/09/2026');
});
test('sin actividad es informativo y no se sustituye por fecha de carga',()=>{
 const r={group:'ops',state:'ok',...f.inspect([['FECHA_ACTUALIZACION'],['2026-09-14']],{group:'ops'},now),...f.operationalReport([{dia:14,teo:576}],{mes:'Septiembre',año:2026},now)};
 assert.equal(f.state(r,now),'Sin actividad registrada');
 assert.equal(f.reference(r).first,null);
 assert.equal(f.summary([r],now).status,'Sin actividad registrada');
 assert.equal(f.displayState({...r,state:'error'},now),'Error de consulta');
});
