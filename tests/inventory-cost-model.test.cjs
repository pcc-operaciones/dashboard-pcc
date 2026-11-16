const test=require('node:test');
const assert=require('node:assert/strict');
const {monthly}=require('../inventory-cost-model.js');

test('Costo inventarios: distingue cierre exacto, corte parcial y fuente sin valoración',()=>{
 const pt=(cutoff,value)=>({cutoff,summary:[
  {company:'EU',knownValue:value,knownCostUnits:1,missingCostUnits:0},
  {company:'TEX',knownValue:0,knownCostUnits:0,missingCostUnits:3}
 ]});
 const log=(cutoff,value)=>({cutoff,summary:[{company:'EU',value}]});
 const source={currentMonth:'2026-11',count:3,company:'EU',
  pt:[pt('2026-08-31',60),pt('2026-09-30',70),pt('2026-10-29',90)],
  log:[log('2026-08-31',50),log('2026-09-30',60),log('2026-10-31',70)]};
 const exact=monthly(source);
 assert.deepEqual(exact.map(p=>p.total),[110,130,70]);
 assert.deepEqual(exact.map(p=>p.delta),[null,20,null]);
 const available=monthly({...source,exact:false});
 assert.equal(available[2].values.pt.cutoff,'2026-10-29');
 assert.equal(available[2].total,null);
 assert.equal(monthly({...source,company:'TEX'})[0].values.pt.value,null);
 assert.equal(monthly({...source,company:''})[1].delta,null);
});
