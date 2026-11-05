const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../cost-model.js');
const now=new Date('2026-11-05T12:00:00Z');
const row=(ref,fecha,ct,extra={})=>({empresa:'EU',linea:'EU',subcat:'LINEA',ref,fecha,ct,cant:10,rent:.1,ccu:.3,margen:5,utilPesos:50,...extra});
test('Costos: decimales exportados no se convierten en miles ni se truncan al calcular la utilidad',()=>{
 for(const value of [12951.699,'12951,699','12951.699','12.951,699','12,951.699'])assert.equal(C.number(value),12951.699);
 assert.equal(C.number('3048,301'),3048.301);assert.equal(C.number('($ 1.234,56)'),-1234.56);
 assert.equal(C.number('0'),0);assert.equal(C.number('#DIV/0!'),null);assert.equal(C.number(''),null);assert.equal(C.number(Infinity),null);
 assert.equal(C.percent('25%'),.25);assert.equal(C.percent(2.5),2.5);assert.equal(C.percent('-1,975'),-1.975);
});
test('Costos: cocientes promedio por registro, cantidades y utilidad monetaria conservan ceros y nulos',()=>{
 const s=C.summary([row('a','2026-01',10),row('a','2026-01',20,{cant:100,rent:0,ccu:null,margen:-5,utilPesos:-50}),row('b','2026-02',30,{rent:null,ccu:0,margen:null,utilPesos:null})]);
 assert.equal(s.rent,.05);assert.equal(s.ccu,.15);assert.equal(s.margin,0);assert.equal(s.profit,0);assert.equal(s.units,120);assert.equal(C.summary([]).profit,null);
});
test('Costos: el período predeterminado es el año calendario actual y todos sus meses disponibles',()=>{
 const rows=[row('a','2025-12',1),row('a','2026-01',1),row('a','2026-10',1)];const p=C.period(rows,undefined,now);
 assert.deepEqual(p.years,['2026']);assert.deepEqual(p.periods,[]);assert.deepEqual(p.keys,['2026-01','2026-10']);assert.equal(p.anchor,'2026-11');
 assert.deepEqual(rows.filter(r=>C.inPeriod(r,p)).map(r=>r.fecha),['2026-01','2026-10']);
 assert.deepEqual(C.period(rows,undefined,new Date('2027-01-01T12:00:00Z')).keys,[]);
});
test('Costos: selección múltiple de años/meses elimina meses incompatibles y admite todos los años explícitamente',()=>{
 const rows=[row('a','2025-12',1),row('a','2026-01',1),row('a','2026-10',1)];
 const p=C.period(rows,{years:['2026'],periods:['2026-10','2025-12','bad']},now);assert.deepEqual(p.keys,['2026-10']);assert.equal(p.anchor,'2026-10');
 assert.equal(rows.filter(r=>C.inPeriod(r,C.period(rows,{years:[],periods:[]},now))).length,3);
 const past=C.period(rows,{years:['2025'],periods:[]},now);assert.equal(past.anchor,'2025-12');
});
test('Costos: Empresa EU y línea EU tienen alcances distintos; TYT es TWO&TWO y se conserva la categoría original',()=>{
 assert.equal(C.classify(row('a','2026-01',1,{subcat:'TYT'})).nativeLine,'TWOTWO');
 assert.equal(C.classify(row('a','2026-01',1,{subcat:'YETRO',linea:'YETRO'})).company,'EU');
 assert.equal(C.classify(row('a','2026-01',1,{empresa:'TEXSION',linea:'TEX',subcat:'DOTACION'})).cats[0],'DOTACIÓN');
});
test('Costos: agrupa lotes por referencia y unidad de negocio sin mezclar empresas ni sumar porcentajes',()=>{
 const groups=C.references([row('same','2026-01',1),row('same','2026-02',1,{rent:.3,utilPesos:0}),row('same','2026-02',1,{empresa:'TEXSION',linea:'TEX',subcat:'LAXO'})]);
 assert.equal(groups.length,2);assert.equal(groups[0].rent,.2);assert.equal(groups[0].cant,20);assert.equal(groups[0].utilPesos,50);assert.equal(groups[0].count,2);
});
test('Costos: top/bottom 10 por rentabilidad suman el dinero real de sus referencias',()=>{
 const groups=C.references(Array.from({length:25},(_,i)=>row('r'+i,'2026-10',1,{rent:i/100,utilPesos:i*10})));
 const ranking=C.rankings(groups);assert.equal(ranking.top.rows.length,10);assert.equal(ranking.top.rows[0].ref,'r24');assert.equal(ranking.bottom.rows[0].ref,'r0');
 assert.equal(ranking.top.profit,1950);assert.equal(ranking.bottom.profit,450);
});
test('Costos: utilidad conocida cero no se confunde con dato ausente; el subtotal parcial se identifica',()=>{
 const ranking=C.rankings(C.references([row('a','2026-01',1,{utilPesos:0}),row('a','2026-02',1,{utilPesos:null})]));
 assert.equal(ranking.top.profit,0);assert.equal(ranking.top.missingProfit,1);
 assert.equal(C.rankings(C.references([row('a','2026-01',1,{utilPesos:null})])).top.profit,null);
});
test('Costos: ventanas mensuales cruzan años sin el desborde de los días 29–31',()=>{
 const w=C.windows('2026-01');assert.deepEqual(w.recent,['2025-12','2026-01']);assert.deepEqual(w.historical,['2025-06','2025-07','2025-08','2025-09','2025-10','2025-11']);
 assert.deepEqual(C.windows('2026-03').recent,['2026-02','2026-03']);
});
test('Costos: variación compara costo total unitario medio por lote, excluye ajustes y ordena ambos signos',()=>{
 const rows=[row('a','2026-05',100),row('a','2026-09',100),row('a','2026-10',120),row('a','2026-11',140,{cant:1000}),row('a','2026-11',10000,{tela:0,promTela:0}),row('a','2026-11',5000,{cant:0}),row('b','2026-05',100),row('b','2026-10',50),row('incompleta','2026-10',500),row('igual','2026-05',100),row('igual','2026-10',100)];
 const v=C.variations(rows,'2026-11');assert.equal(v.rows.length,2);assert.equal(v.rows[0].ref,'b');assert.equal(v.rows[0].delta,-.5);
 const a=v.rows[1];assert.equal(a.before,100);assert.equal(a.after,130);assert.equal(a.change,30);assert.equal(a.delta,.3);assert.equal(a.recentCount,2);assert.equal(a.historicalCount,2);
 assert.equal(C.variations(rows,'2026-11',new Set([a.id])).rows.length,1);
});
