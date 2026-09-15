
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../executive-model.js'),data=require('../data-quality.js'),fresh=require('../source-freshness.js');
const config={mes:'Septiembre',año:2026};
const deps={data,fresh};
function base(){return {config,ops:{status:'ready',mods:[{pk:'EU',daily:[{pro:150,um:100,real:80,teo:100}]}],records:[]},cos:{status:'ready',rows:[{fecha:'2026-09',rent:.2},{fecha:'2026-09',rent:-.1},{fecha:'2026-08',rent:.9}],records:[]},inv:{status:'ready',rows:[{u0:80,u1:0,u2:0,u3:20}],records:[]}};}
test('mapea cinco áreas, solo tres activas, sin métricas ficticias para futuras áreas',()=>{const r=M.build(base(),deps);assert.equal(r.areas.length,5);assert.equal(r.areas.filter(a=>a.active).length,3);assert.equal(r.metrics.length,6);assert.ok(r.metrics.every(m=>!['log','sales'].includes(m.area)));});
test('costos ejecutivos respetan el mes configurado y conservan promedio del área',()=>{const r=M.build(base(),deps);assert.equal(r.metrics.find(m=>m.id==='cost-rent').value,.05);assert.equal(r.metrics.find(m=>m.id==='cost-negative').value,1);});
test('configuración ausente no mezcla todos los años ni presenta métricas operativas',()=>{const i=base();i.config=null;const r=M.build(i,deps);assert.equal(r.key,null);assert.ok(r.metrics.filter(m=>m.area!=='inv').every(m=>m.value===null));assert.equal(r.metrics.find(m=>m.id==='inventory-units').value,100);});
test('sin datos, rentabilidad inválida y cero real tienen significados distintos',()=>{assert.equal(M.costSummary([],'2026-09').negative,null);assert.equal(M.costSummary([{fecha:'2026-09',rent:null}],'2026-09').negative,null);assert.equal(M.costSummary([{fecha:'2026-09',rent:0}],'2026-09').negative,0);assert.equal(M.inventorySummary([]).units,null);assert.equal(M.inventorySummary([{u0:0,u3:0}]).units,0);});
test('el resumen de inventario excluye Segundas y Cobros y no requiere mes actual',()=>{assert.deepEqual(M.inventorySummary([{u0:10,u1:20,u2:30,u3:40},{esSeg:true,u0:1000},{esCobros:true,u3:1000}]),{units:100,aged:40,agedShare:.4});});
test('un error o recarga impide mostrar un resultado anterior como vigente',()=>{for(const state of ['error','loading','empty']){const i=base();for(const area of ['ops','cos','inv'])i[area].status=state;const r=M.build(i,deps);assert.ok(r.metrics.every(m=>m.value===null));}});
test('cumplimiento mayor a 100% conserva valor y usa la fórmula ponderada del área',()=>{const r=M.build(base(),deps);assert.equal(r.metrics.find(m=>m.id==='compliance').value,1.5);assert.equal(r.metrics.find(m=>m.id==='efficiency').value,.8);});
test('fuentes sin fecha conservan su estado informativo sin crear alertas',()=>{const i=base();i.ops.records=[{group:'ops',state:'ok'}];const r=M.build(i,deps);assert.equal(r.areas[0].status,'Fechas por confirmar');assert.ok(!r.issues.some(issue=>issue.area==='ops'));});
test('compromisos requieren responsable, área activa y fecha calendario válida',()=>{const task={id:'a',title:'Revisar',owner:'Gerente',area:'ops',due:'2026-09-15',status:'Pendiente'};assert.ok(M.validateTask(task));for(const delta of [{owner:''},{area:'log'},{due:'2026-02-30'},{status:'otro'}])assert.equal(M.validateTask({...task,...delta}),null);});
test('compromisos vencidos usan la fecha acordada y completados no vencen',()=>{const t={status:'En curso',due:'2026-09-10'};assert.equal(M.taskState(t,'2026-09-14'),'Vencido');assert.equal(M.taskState({...t,status:'Completado'},'2026-09-14'),'Completado');assert.equal(M.taskState(t,'2026-09-10'),'En curso');});

const reviewNow=new Date('2026-09-15T15:00:00Z');
function healthy(){const i=base();i.cos.rows=[{fecha:'2026-09',rent:.2}];i.inv.rows=[{u0:100,u3:0}];return i;}
function activity(day,name){return {group:'ops',state:'ok',sheet:name,...fresh.operationalReport([{dia:day,pro:1}],config,reviewNow)};}
test('sin desvíos no se generan alertas por falta de metadatos, actividad o costeos',()=>{
 const i=healthy();i.ops.records=[activity(14,'MOD2'),{group:'ops',state:'ok',freshnessBasis:'activity'}];i.cos.rows=[];i.cos.records=[{group:'cos',state:'ok'}];
 const r=M.build(i,deps,reviewNow);
 assert.equal(r.issues.length,0);
 assert.equal(r.areas.find(a=>a.id==='cos').status,'Fechas por confirmar');
});
test('una alerta de atraso incluye solo las fuentes atrasadas de un área mixta',()=>{
 const i=healthy();i.ops.records=[activity(14,'MOD2 al día'),activity(10,'MOD3 atrasado'),{group:'ops',state:'ok',sheet:'Sin fecha'}];
 const alerts=M.build(i,deps,reviewNow).issues;
 assert.equal(alerts.length,1);assert.equal(alerts[0].id,'ops-source-delay');
 assert.deepEqual(alerts[0].sources.map(s=>s.name),['MOD3 atrasado']);
 assert.equal(alerts[0].sources[0].reference,'10/09/2026');
});
test('fallos y atrasos se conservan por separado, sin señalar fuentes sanas',()=>{
 const i=healthy();i.ops.records=[activity(14,'MOD2'),activity(10,'MOD3'),{group:'ops',state:'error',sheet:'EF M7'}];
 const alerts=M.build(i,deps,reviewNow).issues;
 assert.deepEqual(alerts.map(a=>a.id),['ops-source-errors','ops-source-delay']);
 assert.deepEqual(alerts.flatMap(a=>a.sources.map(s=>s.name)),['EF M7','MOD3']);
 i.ops.records=[activity(14,'MOD2'),activity(14,'MOD3'),activity(14,'EF M7')];
 assert.equal(M.build(i,deps,reviewNow).issues.length,0);
});
test('cargando no produce alertas, pero un fallo general sí requiere acción',()=>{
 const i=healthy();i.ops.status='loading';i.ops.records=[{group:'ops',state:'loading',sheet:'MOD2'}];
 assert.equal(M.build(i,deps,reviewNow).issues.length,0);
 i.ops.status='error';
 assert.deepEqual(M.build(i,deps,reviewNow).issues.map(a=>a.id),['ops-error']);
});
test('se conservan desviaciones reales de operación, costos e inventario',()=>{
 const i=base();i.ops.mods=[{pk:'EU',daily:[{pro:50,um:100,real:50,teo:100}]}];
 assert.deepEqual(M.build(i,deps,reviewNow).issues.map(a=>a.id),['ops-plan','ops-efficiency','cos-negative','inv-aged']);
});
