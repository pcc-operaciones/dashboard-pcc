const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../inventory-history-model.js'),money=require('../money-format.js').format;
const cuts=dates=>dates.map(cutoff=>({cutoff}));
test('mensual conserva cierres exactos y no sustituye cargas intermedias ni futuras',()=>{
 const p=M.inventoryMonthlyCuts(cuts(['2026-09-17','2026-09-30','2026-10-29','2026-11-20','2026-11-30']),'2026-11-20');
 assert.deepEqual(p.map(x=>[x.cutoff,x.closed,x.current]),[['2026-09-30',true,false],[null,false,false],['2026-11-20',false,true]]);
});
test('cierre actual aparece una vez, soporta año bisiesto, vacíos y límite de 12 meses',()=>{
 assert.deepEqual(M.inventoryMonthlyCuts(cuts(['2024-01-31','2024-02-29']),'2024-02-29').map(p=>p.closed),[true,true]);
 assert.equal(M.inventoryMonthlyCuts([],'2026-09-20')[0].cutoff,'2026-09-20');
 const p=M.inventoryMonthlyCuts(cuts(['2024-01-31','2026-09-20']),'2026-09-20');assert.equal(p.length,12);assert.equal(p[0].month,'2025-10');
});
test('unidades y pesos usan mismo filtro, costo propio del corte y desconocidos no son cero',()=>{
 const r=(units,value,warehouse='PT001')=>({units,value,warehouse,committed:0,available:units});
 const p=M.inventoryMonthlyValues([{rows:[r(10,100),r(20,800,'PT002')]},{rows:[r(10,150),r(3,null)]},{rows:[r(10,null)]},{rows:null},{rows:[]}],r=>r.warehouse==='PT001');
 assert.deepEqual(p.map(x=>x.units),[10,13,10,null,0]);assert.deepEqual(p.map(x=>x.amount),[100,150,null,null,0]);assert.equal(p[1].totals.missingCostUnits,3);
});
test('pesos completos con separadores colombianos, decimales y negativos',()=>{
 assert.equal(money(4743951968.71),'$ 4.743.951.968,71');assert.equal(money(25000),'$ 25.000');assert.equal(money(-1800000),'$ -1.800.000');assert.equal(money(0),'$ 0');assert.equal(money(null),'—');
});
