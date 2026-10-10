const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const M=require('../inventory-history-model.js');
const batch=(cutoff='2026-09-30')=>({cutoff,coverage:['EU','TEX'].map(company=>({company,from:'2026-06-01',to:cutoff,complete:true})),movements:[
 {company:'EU',ref:'01',warehouse:'PT001',date:'2026-09-01',type:'RM',out:10,costOut:120},
 {company:'EU',ref:'01',warehouse:'PT001',date:'2026-09-30',type:'RM',out:5,costOut:75},
 {company:'EU',ref:'01',warehouse:'PT002',date:'2026-09-30',type:'RM',out:2,costOut:20},
 {company:'EU',ref:'01',warehouse:'PT001',date:'2026-08-31',type:'RM',out:100,costOut:1200},
 {company:'TEX',ref:'02',warehouse:'PT001',date:'2026-09-30',type:'TRI',out:100,costOut:2000}]});
test('despachos de cierre incluyen extremos, excluyen traslados y conservan costo ERP del movimiento',()=>{
 const detail={performance:{dispatch:M.dispatchSnapshot(batch()),aging:null}},v=M.performanceAtCut(detail);
 assert.equal(v.units,15);assert.equal(v.amount,195);assert.equal(v.obsolescence,null);
 assert.equal(M.performanceAtCut(detail,r=>r.company==='TEX').units,0);
 const oct=batch('2026-10-10');oct.movements.push({company:'EU',ref:'01',warehouse:'PT001',date:'2026-10-01',type:'RM',out:3,costOut:100});
 assert.equal(M.performanceAtCut({performance:{dispatch:M.dispatchSnapshot(oct)}}).units,3);
 assert.equal(M.performanceAtCut(detail).amount,195);
});
test('cobertura incompleta no es cero y un despacho sin costo no se presenta como valor completo',()=>{
 const b=batch();b.coverage[1].from='2026-09-02';assert.equal(M.dispatchSnapshot(b),null);
 const d=batch();d.movements[0].costOut=0;const v=M.performanceAtCut({performance:{dispatch:M.dispatchSnapshot(d)}});
 assert.equal(v.amount,75);assert.equal(v.missingCostUnits,10);
 d.movements[1].costOut=0;assert.equal(M.performanceAtCut({performance:{dispatch:M.dispatchSnapshot(d)}}).amount,null);
});
test('obsolescencia usa costos y antigüedad del corte, con exclusiones y filtros',()=>{
 const aging=[{company:'EU',warehouse:'PT001',knownValue:1000,riskValue:571,missingCostUnits:2},{company:'TEX',warehouse:'PT002',knownValue:9999,riskValue:9999,missingCostUnits:0}];
 const v=M.performanceAtCut({performance:{aging}});assert.equal(v.obsolescence,57.099999999999994);assert.equal(v.agingMissing,2);
 assert.equal(M.performanceAtCut({performance:{aging}},r=>r.company==='TEX').obsolescence,null);
});
test('serie mensual solo usa fin de mes, no sustituye un cierre ausente ni resalta el máximo',()=>{
 const points=M.inventoryMonthlyCuts([{cutoff:'2026-08-29'},{cutoff:'2026-09-30'},{cutoff:'2026-10-07'}],'2026-10-07',6);
 assert.equal(points[0].cut,null);assert.equal(points[1].closed,true);assert.equal(points[1].current,false);assert.equal(points[2].current,true);
});
test('métricas derivadas usan fecha y archivos propios y se reutilizan sin recalcular',()=>{
 const b={...batch(),inventory:[]},load={id:'load',folderId:'folder'},saved=new Map();let called=0;
 const c=vm.createContext({PccHistoryModel:M,DriveApp:{getFolderById:id=>id},pccHistNamed_:(f,n)=>saved.get(n),pccHistRead_:f=>structuredClone(f),pccHistJson_:(f,n,v)=>{saved.set(n,structuredClone(v));return v;},
 calcularEdadFIFO(a,b,c,d,date){called++;assert.equal(date,'2026-09-30');return {};},buildResumen:()=>[['Empresa','Referencia','Bodega','Descripcion','Valor_Conocido','Costo_90mas','Uds_Sin_Costo'],['EU','01','PT001','Prenda',1000,571,2]],buildBodegas:()=>[],pccHistValueTables_(){},pccHistReconcileCurrent_(){}});
 ['invEU','invTEX','movEU','movTEX'].forEach(r=>saved.set(r+'.json',[['Fecha'],['2026-09-30']]));
 vm.runInContext(fs.readFileSync('apps-script/inventory-history/MonthlyMetrics.gs','utf8'),c);
 const result=c.pccHistMonthlyMetrics_(load,b);assert.equal(result.aging[0].riskValue,571);assert.equal(result.dispatch.to,b.cutoff);
 c.pccHistMonthlyMetrics_(load,b);assert.equal(called,1);
 assert.throws(()=>c.pccHistMonthlyMetrics_(load,{...b,cutoff:'2026-10-01'}),/no coinciden/);
});
test('gráficos respetan filtros nuevos, muestran etiquetas permanentes y destacan el mes actual aunque sea menor',async()=>{
 const nodes=new Map(),element=()=>({style:{},children:[],append(x){this.children.push(x);},replaceChildren(...xs){this.children=xs;},parentElement:{style:{}}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};let resolve;
 const ctx={document:{getElementById:get,createElement:element},PccHistoryModel:M,PccMoney:{format:v=>'$ '+v.toLocaleString('es-CO')},INV_DATA:[{empresa:'EU',ref:'01',lineaReal:'EU Línea',u0:10,c0:100,c1:0,c2:0,c3:0}],MOV_DATA:[],REF_MAP:{},DESC_MAP:{},glFilter:()=>true,resumenExistencias:()=>({cutoff:'2026-10-08'}),clasificarRef:()=> 'EU Línea',destroyChart(){},Chart:class{constructor(node,config){Object.assign(this,config);}}};
 ctx.window=ctx;ctx.PccInventoryHistoryView={performanceSeries:()=>new Promise(r=>resolve=r)};vm.createContext(ctx);vm.runInContext(fs.readFileSync('inventory-performance.js','utf8'),ctx);
 const old=ctx.PccInventoryPerformance.render();const finishOld=resolve;
 const fresh=ctx.PccInventoryPerformance.render();
 const point=(month,units,current)=>({month,cutoff:month+'-'+(current?'08':'30'),current,closed:!current,cut:{},detail:{performance:{aging:[],dispatch:{rows:[{company:'EU',ref:'01',warehouse:'PT001',units,amount:units*100,missingCostUnits:0}]}}}});
 resolve([point('2026-09',100,false),point('2026-10',20,true)]);await fresh;
 finishOld([point('2026-10',999,true)]);await old;
 assert.deepEqual(Array.from(ctx._ch4.data.datasets[0].data),[100,20]);
 assert.deepEqual(Array.from(ctx._ch4.data.datasets[0].backgroundColor),['#9BC2BE','#0D6B5E']);
 assert.equal(ctx._ch4.options.plugins.datalabels.display({dataset:{data:[20]},dataIndex:0}),true);
 assert.equal(ctx._ch4money.options.plugins.datalabels.formatter(2000,{dataIndex:1}),'$ 2.000');
 assert.equal(nodes.get('ch4-val').textContent,'20');
});
