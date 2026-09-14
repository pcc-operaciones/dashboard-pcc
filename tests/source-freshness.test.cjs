
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
