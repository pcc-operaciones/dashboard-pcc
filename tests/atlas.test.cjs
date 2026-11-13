const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../atlas-model.js'),E=require('../executive-model.js'),D=require('../data-quality.js');
const deps={period:E.period,ops:D.ops,now:()=>new Date('2026-11-05T12:00:00Z')};
function base(){return {config:{mes:'Octubre',año:2026},ops:{status:'ready',mods:[{pk:'EU',daily:[{pro:150,um:100,real:80,teo:100}]}]},wip:{status:'ready',all:[{empresa:'EU',clasificacion:'LINEA',estado:'CORTE',cant:20,fProg:'2026-09',fCorte:'2026-10',ordenCorte:'lot-a',refSap:'ref-a'},{empresa:'TEX',mundo:'',estado:'CONFECCION',cant:30,fPres:'2026-10'}]},cos:{status:'ready',rows:[{empresa:'EU',subcat:'LINEA',fecha:'2026-10',ref:'r',lote:1,rent:-.1,ccu:.2,margen:-10},{empresa:'EU',subcat:'LINEA',fecha:'2026-10',ref:'r',lote:2,rent:-.2,ccu:.4,margen:-20},{empresa:'TEXSION',subcat:'LAXO',fecha:'2026-10',ref:'s',lote:3,rent:.6,ccu:null,margen:60},{empresa:'EU',subcat:'LINEA',fecha:'2025-10',rent:.9}]},inv:{status:'ready',cutoff:'2026-10-26',period:{from:'2026-07-26',to:'2026-10-26'},rows:[{empresa:'EU',lineaReal:'EU Línea',ref:'ref-a',totalUds:100,u0:60,u1:0,u2:0,u3:40,knownValue:800,missingCostUnits:0},{empresa:'TEX',lineaReal:'Tex Eva/Laxo',desc:'LAXO',esSeg:true,totalUds:2,u3:2,knownValue:0,missingCostUnits:2}],movements:[{empresa:'EU',ref:'ref-a',linea:'EU Línea',tipo:'EOP',fecha:'2026-10-01',entradas:40,salidas:0},{empresa:'EU',ref:'ref-a',linea:'EU Línea',tipo:'RM',fecha:'2026-10-01',salidas:15,entradas:0},{empresa:'EU',ref:'ref-a',linea:'EU Línea',tipo:'DRM',fecha:'2026-10-01',entradas:99,salidas:0}]},log:{status:'ready',ageReady:true,meta:{corte_inventario:'2026-10-26',movimientos_desde:'2026-08-03',movimientos_hasta:'2026-10-26'},stock:[{company:'EU',warehouse:'MT001',costTotal:1000},{company:'TEX',warehouse:'MT002',costTotal:500}],age:[{company:'EU',warehouse:'MT001',riskValue:400,values:[100,200,200,400,100]},{company:'TEX',warehouse:'MT002',riskValue:100,values:[100,100,100,100,100]}],moves:[{company:'EU',warehouse:'MT001',date:'2026-10-05',inCost:100,outCost:80},{company:'TEX',warehouse:'MT002',date:'2026-10-05',inCost:50,outCost:30}]}};}
test('respeta año y mes configurados; no convierte meses futuros en ceros',()=>{const v=M.build(base(),{},deps);assert.equal(v.key,'2026-10');assert.equal(v.months.length,10);assert.equal(v.cos.count,3);assert.ok(Math.abs(v.cos.rent-.1)<1e-12);assert.equal(v.ops.stages[1].values[9],20);assert.equal(v.ops.compliance,1.5);assert.equal(v.ops.efficiency,.8);});
test('promedios usan denominadores válidos independientes, sin ponderar porcentajes por unidades',()=>{const v=M.build(base(),{},deps);assert.ok(Math.abs(v.cos.ccu-.3)<1e-12);assert.equal(v.cos.margin,10);});
test('los negativos son registros y conservan dos lotes de la misma referencia',()=>{const v=M.build(base(),{},deps);assert.equal(v.cos.negativeCount,2);assert.equal(new Set(v.cos.negative.map(r=>r.ref)).size,1);assert.notEqual(v.cos.negative[0].id,v.cos.negative[1].id);assert.deepEqual(v.cos.negative.map(r=>r.lote),[1,2]);});
test('un detalle conserva su identidad de referencia/lote aunque el origen cambie el orden al actualizar',()=>{const source=base(),before=M.build(source,{},deps).cos.negative.find(r=>r.lote===2);source.cos.rows.reverse();const after=M.build(source,{},deps).cos.negative.find(r=>r.lote===2);assert.equal(before.id,after.id);});
test('empresa, línea y categoría filtran métricas y filas del mismo alcance sin mutar el área',()=>{const source=base(),before=JSON.stringify(source),v=M.build(source,{company:['EU'],line:['EU'],category:['EU Línea']},deps);assert.equal(v.cos.count,2);assert.equal(v.ops.wipUnits,20);assert.equal(v.inv.units,100);assert.equal(v.inv.missingCostUnits,0);assert.equal(JSON.stringify(source),before);assert.equal(v.ops.efficiency,null);assert.equal(v.log.total,1000);assert.deepEqual(v.log.companies,['EU']);});
test('categorías dependen de empresa y línea; ignora selecciones inválidas',()=>{assert.deepEqual(M.cleanFilters({company:['TEX','fake'],line:['EU','TEXSION'],category:['EU Moda','LAXO','fake']}),{company:['TEX'],line:['TEXSION'],category:['LAXO']});});
test('no inventa el desglose de categoría TEX en WIP ni el de producto en Logística',()=>{const v=M.build(base(),{category:['LAXO']},deps);assert.equal(v.ops.wipSupported,false);assert.equal(v.ops.wipUnits,null);assert.ok(v.ops.stages.every(s=>s.values.every(n=>n===null)));assert.equal(v.log.supported,false);assert.equal(v.log.aged,100);assert.equal(v.log.total,500);assert.deepEqual(v.log.companies,['TEX']);assert.equal(v.cos.count,1);});
test('PT total incluye todas las bodegas y antigüedad usa solo el universo principal',()=>{const v=M.build(base(),{},deps);assert.equal(v.inv.units,102);assert.equal(v.inv.principal,100);assert.equal(v.inv.age[3],40);assert.equal(v.inv.agedShare,.4);assert.equal(v.inv.knownValue,800);assert.equal(v.inv.missingCostUnits,2);});
test('WIP: distingue días en estado de días en proceso y excluye fechas desconocidas y lotes cerrados',()=>{
 const source=base();
 source.wip.all=[
  {empresa:'EU',estado:'CORTADO',cant:10,traza:{programacion:{ini:'2026-07-01'},corte:{ini:'2026-07-03',fin:'2026-10-20'}}},
  {empresa:'EU',estado:'CONFECCION',cant:20,traza:{programacion:{ini:'2026-08-07'},confeccion:{ini:'2026-10-30'}}},
  {empresa:'EU',estado:'COSTEO',cant:30,traza:{presentacion:{ini:'2026-02-30'}}},
  {empresa:'EU',estado:'ENTREGADO',cant:40,traza:{programacion:{ini:'2026-07-01'}}}
 ];
 const {ops}=M.build(source,{},deps);
 assert.equal(ops.agedUnits,10);
 assert.equal(ops.lots[1].processDays,90);
 assert.equal(ops.undatedUnits,30);
 assert.equal(ops.agedLots[0].stateSince,'2026-10-20');
 assert.equal(ops.agedLots[0].stateDays,16);
 assert.equal(ops.lots[2].stateDays,null);
});
test('consolidado suma existencias valoradas por sección y mantiene el WIP fuera del valor',()=>{
 const source=base();
 source.inv.rows[0].c3=320;
 source.inv.rows[1].c3=44;
 const view=M.build(source,{},deps);
 assert.equal(view.inventory.total,2300);
 assert.equal(view.inv.agedValue,320);
 assert.equal(view.inventory.rows.find(row=>row.section==='Producto en proceso (WIP)').value,null);
 assert.equal(view.inventory.rows.find(row=>row.section==='Producto en proceso (WIP)').units,50);
 source.log.status='error';
 const partial=M.build(source,{},deps);
 assert.equal(partial.inventory.total,800);
 assert.equal(partial.inventory.rows.find(row=>row.section==='Telas').value,null);
 assert.equal(view.inventory.rows.find(row=>row.section==='Inventario Tienda Yetro').value,null);
});
test('el consolidado conserva el corte validado de Logística aunque fallen movimientos o recarga',()=>{
 const source=base();
 source.log.stockReady=true;
 source.log.movementsReady=false;
 source.log.ageReady=false;
 source.log.status='error';
 const view=M.build(source,{},deps);
 assert.equal(view.inventory.total,2300);
 assert.equal(view.inventory.rows.find(row=>row.section==='Telas').value,1000);
 assert.match(view.inventory.rows.find(row=>row.section==='Telas').status,/último corte validado/);
 assert.equal(view.log.movementsReady,false);
 assert.equal(view.log.aged,null);
});
test('flujos PT conservan ventana parcial y separan EOP/RM de devoluciones',()=>{const v=M.build(base(),{},deps);assert.deepEqual(v.inv.movements.labels,['Jul.*','Ago.','Sep.','Oct.*']);assert.equal(v.inv.movements.received[3],40);assert.equal(v.inv.movements.shipped[3],15);});
test('Logística conserva empresa, valor monetario y edad indeterminada aparte',()=>{const v=M.build(base(),{company:['TEX']},deps);assert.equal(v.log.total,500);assert.equal(v.log.aged,100);assert.equal(v.log.unknown,100);assert.deepEqual(v.log.warehouses.map(w=>w.value),[0,500]);assert.equal(v.log.movements.received[2],50);});
test('error, recarga y fuente vacía ocultan datos anteriores; ausencia no es cero',()=>{for(const status of ['error','loading','empty']){const source=base();for(const key of ['ops','wip','cos','inv','log'])source[key].status=status;const v=M.build(source,{},deps);assert.equal(v.ops.efficiency,null);assert.equal(v.ops.wipUnits,null);assert.equal(v.cos.rent,null);assert.equal(v.cos.count,null);assert.equal(v.inv.units,null);assert.equal(v.inv.knownValue,null);assert.equal(v.log.total,null);assert.equal(v.log.aged,null);}});
test('sin período operativo Costos conserva el año actual; inventarios y WIP conservan su propio corte',()=>{const source=base();source.config=null;const v=M.build(source,{},deps);assert.ok(Math.abs(v.cos.rent-.1)<1e-12);assert.equal(v.cos.count,3);assert.equal(v.ops.compliance,null);assert.equal(v.ops.wipUnits,50);assert.equal(v.inv.units,102);assert.deepEqual(v.months,[]);});
test('sin FIFO validado no presenta cero como saldo envejecido',()=>{const source=base();source.log.ageReady=false;const v=M.build(source,{},deps);assert.equal(v.log.total,1500);assert.equal(v.log.aged,null);assert.equal(v.log.unknown,null);});
test('inventario sin metadata de costo conserva valor conocido cero y unidades no valoradas',()=>{const source=base();source.inv.rows=[{empresa:'EU',lineaReal:'EU Línea',totalUds:3,u0:3}];const v=M.build(source,{},deps);assert.equal(v.inv.knownValue,0);assert.equal(v.inv.missingCostUnits,3);});
test('ausencia de rentabilidad válida no cuenta nulos como negativos; cero válido sí se conserva',()=>{const source=base();source.cos.rows=[{empresa:'EU',subcat:'LINEA',fecha:'2026-10',rent:null}];assert.equal(M.build(source,{},deps).cos.negativeCount,null);source.cos.rows[0].rent=0;const v=M.build(source,{},deps);assert.equal(v.cos.negativeCount,0);assert.equal(v.cos.rent,0);});
test('ventana inválida no fabrica meses de movimientos',()=>{const source=base();source.inv.period={from:null,to:null};assert.deepEqual(M.build(source,{},deps).inv.movements.keys,[]);});

test('tendencias diarias y procesos usan los mismos numeradores y denominadores del indicador global',()=>{
 const source=base();source.ops.mods=[
  {pk:'EU',daily:[{dia:2,pro:40,um:100,real:50,teo:100},{dia:1,pro:10,um:20,real:5,teo:10}]},
  {pk:'EU',daily:[{dia:2,pro:150,um:300,real:90,teo:100}]},
  {pk:'PRES',daily:[{dia:2,pro:100,um:10,real:100,teo:20}]},
  {pk:'SERV',daily:[{dia:2,pro:200,um:100,real:10000,teo:1}]}
 ];
 const v=M.build(source,{},deps),p=v.ops.performance;
 assert.deepEqual(p.days,[1,2]);assert.equal(p.efficiency.meta,.75);assert.equal(p.compliance.meta,1);
 assert.equal(p.efficiency.values[0],.5);assert.equal(p.efficiency.values[1],240/220);
 assert.equal(p.compliance.values[1],490/510);
 const eu=source.ops.mods.filter(m=>m.pk==='EU');
 assert.equal(p.efficiency.processes.find(p=>p.id==='EU').value,D.ops(eu,'ef'));
 assert.ok(!p.efficiency.processes.some(p=>p.id==='SERV'));assert.ok(p.compliance.processes.some(p=>p.id==='SERV'));
 assert.equal(p.efficiency.processes.find(p=>p.id==='PRES').value,5);
});
test('tendencia conserva ceros válidos y huecos sin denominador; no crea días futuros ni ceros ficticios',()=>{
 const source=base();source.ops.mods=[{pk:'EU',daily:[{dia:3,pro:5,um:0,real:1,teo:0},{dia:1,pro:0,um:20,real:0,teo:10},{dia:0,pro:10,um:10},{dia:32,pro:10,um:10}]}];
 const p=M.build(source,{},deps).ops.performance;
 assert.deepEqual(p.days,[1,3]);assert.deepEqual(p.efficiency.values,[null,null]);assert.deepEqual(p.compliance.values,[0,null]);
 assert.deepEqual(p.efficiency.processes,[]);
});
test('el detalle diario y por proceso no publica fuentes fallidas ni desgloses inexistentes',()=>{
 for(const status of ['error','loading','empty']){const source=base();source.ops.status=status;const p=M.build(source,{},deps).ops.performance;assert.deepEqual(p.days,[]);assert.deepEqual(p.efficiency.processes,[]);assert.deepEqual(p.compliance.values,[]);}
 const p=M.build(base(),{company:['EU']},deps).ops.performance;assert.deepEqual(p.days,[]);assert.deepEqual(p.efficiency.processes,[]);
});


test('Logística conserva totales de empresa bajo filtros de línea y categoría, incluidos movimientos y detalle',()=>{
 for(const filter of [{line:['EU']},{category:['EU Línea']},{line:['YETRO','TWO&TWO']},{company:['EU'],line:['EU'],category:['EU Línea']}]){
  const v=M.build(base(),filter,deps);assert.equal(v.log.ready,true);assert.equal(v.log.supported,false);assert.deepEqual(v.log.companies,['EU']);assert.equal(v.log.total,1000);assert.equal(v.log.aged,400);assert.equal(v.log.unknown,100);assert.equal(v.log.movements.received[2],100);assert.equal(v.log.movements.shipped[2],80);assert.deepEqual(v.log.byCompany,[{company:'EU',value:1000}]);assert.ok(v.log.rows.every(r=>r.company==='EU'));assert.ok(v.log.ageRows.every(r=>r.company==='EU'));
 }
 const both=M.build(base(),{line:['EU','TEXSION']},deps);assert.equal(both.log.total,1500);assert.deepEqual(both.log.companies,['TEX','EU']);
 const source=base();source.log.status='error';assert.equal(M.build(source,{line:['EU']},deps).log.total,null);
 source.log.status='ready';source.log.ageReady=false;assert.equal(M.build(source,{line:['EU']},deps).log.aged,null);
});
