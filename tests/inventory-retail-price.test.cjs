const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../inventory-retail-model.js');
const {runtime}=require('./helpers/inventory-runtime.cjs');

test('el precio exacto corresponde al último costeo válido antes del corte y a su empresa',()=>{
 const rows=[
  {company:'EU',ref:'001',costedAt:'2026-09-10',price:39990},
  {company:'EU',ref:'001',costedAt:'2026-10-01',price:49990},
  {company:'TEXSION',ref:'001',costedAt:'2026-09-12',price:34990},
  {company:'EU',ref:'002',costedAt:'2026-09-14',price:0},
  {company:'EU',ref:'003',costedAt:'2026-09-10',price:29990},
  {company:'EU',ref:'003',costedAt:'2026-09-14',price:''}
 ];
 assert.equal(R.select(rows,'2026-09-30').get('EU|001').price,39990);
 assert.equal(R.select(rows,'2026-10-02').get('EU|001').price,49990);
 assert.equal(R.select(rows,'2026-10-02').get('TEX|001').price,34990);
 assert.equal(R.select(rows,'2026-10-02').get('EU|002').price,null);
 assert.equal(R.select(rows,'2026-10-02').get('EU|003').price,null);
 assert.equal(R.price('12.990'),12990);
});

test('dos precios distintos en el mismo último costeo quedan pendientes de revisión',()=>{
 const result=R.select([{company:'EU',ref:'1',costedAt:'2026-10-01',price:39990},{company:'EU',ref:'1',costedAt:'2026-10-01',price:49990}],'2026-10-02').get('EU|1');
 assert.equal(result.conflict,true);assert.equal(result.price,null);
});

test('el corte guarda sus precios antes de publicar y conserva el importe de inventario a costo',()=>{
 const r=runtime();r.enablePublication();r.declare();r.ctx.procesarHistoricoPT();
 const state=r.state(),load=state.loads[0],retail=r.ctx.pccHistRetailSaved_(load,r.ctx.pccHistRead_(r.objects.get(load.dataId)));
 assert.equal(retail.cutoff,'2026-09-16');
 assert.equal(retail.rows.find(x=>x.company==='EU'&&x.ref==='001').price,39990);
 assert.equal(retail.rows.find(x=>x.company==='TEX'&&x.ref==='001').price,34990);
 const manifest=JSON.parse(r.book.getSheetByName('INV_Hist_Control').getRange(1,1).getValue());
 const rows=r.book.getSheetByName('INV_Hist_Datos').getRange(manifest.row,1,manifest.count,1).getValues();
 const query=JSON.parse(rows.map(x=>x[0].slice(1)).join(''));
 const detailRef=query.cuts[0].detail,parts=r.book.getSheetByName('INV_Hist_Datos').getRange(detailRef.row,1,detailRef.count,1).getValues();
 const detail=JSON.parse(parts.map(x=>x[0].slice(1)).join(''));
 assert.equal(detail.rows.find(x=>x.company==='EU'&&x.ref==='001').retailPrice,39990);
 assert.equal(detail.rows.find(x=>x.company==='EU'&&x.ref==='001').knownValue,0);
});
