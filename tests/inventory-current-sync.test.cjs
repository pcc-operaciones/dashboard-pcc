const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('apps-script/inventory-history/CurrentInventory.gs','utf8');
const ctx=vm.createContext({});vm.runInContext(code,ctx);
const hdr=['Empresa','Referencia','Bodega','Total_Uds'];
const inventory=[{company:'EU',ref:'01',warehouse:'PT001',units:100},{company:'EU',ref:'01',warehouse:'PT002',units:5},{company:'TEX',ref:'01',warehouse:'PT003',units:2}];
const table=[hdr,['EU','01','PT001',100],['EU','01','PT002',5],['TEX','01','PT003',2]];
test('current stock: reconciliation includes seconds and collections with company isolation',()=>assert.doesNotThrow(()=>ctx.pccHistReconcileCurrent_(table,inventory,'test')));
test('current stock: equal grand totals cannot conceal a transfer between warehouses',()=>{const wrong=structuredClone(table);wrong[1][3]--;wrong[2][3]++;assert.throws(()=>ctx.pccHistReconcileCurrent_(wrong,inventory,'test'),/no coincide/);});
test('current stock: missing stock, invalid quantity and missing required header block publication',()=>{assert.throws(()=>ctx.pccHistReconcileCurrent_(table.slice(0,3),inventory,'test'),/no coincide/);assert.throws(()=>ctx.pccHistCurrentGroups_([{...inventory[0],units:NaN}]),/no num/);assert.throws(()=>ctx.pccHistReconcileCurrent_([['Total_Uds']],inventory,'test'),/Falta Empresa/);});
test('current stock: explicit ERP date and company movement windows replace run dates',()=>{const t=[['Empresa','Fecha_Actualizacion'],['EU','2026-09-19'],['TEX','2026-09-19']];ctx.pccHistCurrentDates_(t,{cutoff:'2026-09-18',coverage:[{company:'EU',from:'2026-06-19',to:'2026-09-18'},{company:'TEX',from:'2026-05-18',to:'2026-09-17'}]});assert.deepEqual(t[1],['EU','2026-09-18','2026-09-18','2026-06-19','2026-09-18']);assert.equal(t[2][4],'2026-09-17');});
test('current stock: publication is one batch, clears previous extra rows and writes strings literally',()=>{const sheet={getSheetId:()=>4,getMaxRows:()=>1,getMaxColumns:()=>1,getLastRow:()=>20,getLastColumn:()=>5};const req=ctx.pccHistCurrentRequests_({getSheetByName:()=>sheet},[{name:'INV',rows:[['Ref','Total'],['=unsafe',5]]}],'2026-09-18');const update=req.find(r=>r.updateCells?.fields==='userEnteredValue').updateCells;assert.equal(update.range.endRowIndex,20);assert.equal(update.rows[1].values[0].userEnteredValue.stringValue,'=unsafe');assert.equal(update.rows[1].values[1].userEnteredValue.numberValue,5);assert.equal(req.filter(r=>r.appendDimension).length,2);});
function runtime(){
 const props=new Map([['PCC_HIST_STATE_FILE','state'],['PCC_HIST_PUBLISHED_STATE','state'],['PCC_HIST_PUBLICATION_VERSION','3']]);
 const batch={cutoff:'2026-09-18',inventoryComplete:true,inventory,coverage:[{company:'EU',complete:true,from:'2026-06-19',to:'2026-09-18'},{company:'TEX',complete:true,from:'2026-06-19',to:'2026-09-18'}]};
 const load={id:'load',dataId:'data',folderId:'folder'};let writes=0,failure=false,transformCalls=0;
 const svc={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v)};
 const sheet={getSheetId:()=>1,getMaxRows:()=>100,getMaxColumns:()=>30,getLastRow:()=>10,getLastColumn:()=>10,getDataRange:()=>({getValues:()=>table})};
 // Valuation helpers have independent arithmetic/migration tests; these tests isolate orchestration.
 const c=vm.createContext({pccHistValuedBatch_:(load,batch)=>batch,pccHistValueTables_(){},pccHistReconcileValue_(){},console:{log(){},error(){}},CFG:{OUTPUT_ID:'out',HOJA_RESUMEN:'R',HOJA_BODEGAS:'B',HOJA_MOVIMIENTOS:'M'},PropertiesService:{getScriptProperties:()=>svc},pccHistState_:()=>({current:load,loads:[load]}),pccHistRead_:f=>f==='data'?batch:[['Fecha'],['2026-09-18']],pccHistNamed_:()=> 'rows',DriveApp:{getFileById:id=>id,getFolderById:id=>id},cargarTrazabilidad:()=>({}),calcularEdadFIFO(a,b,c,d,e){transformCalls++;assert.equal(e,'2026-09-18');return {};},buildResumen:()=>structuredClone(table),buildBodegas:()=>structuredClone(table),buildMovimientos:()=>[['Empresa','Fecha_Actualizacion'],['EU','old']],SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},ScriptApp:{getOAuthToken:()=> 'not-a-real-token'},UrlFetchApp:{fetch(url,opt){writes++;assert.match(url,/:batchUpdate$/);assert.ok(JSON.parse(opt.payload).requests.length>=6);return {getResponseCode:()=>failure?400:200,getContentText:()=> 'simulated failure'};}}});
 vm.runInContext(code,c);return {c,props,batch,run:()=>c.pccHistTrySyncCurrent_(Date.now()+200000),writes:()=>writes,calls:()=>transformCalls,fail:()=>failure=true};
}
test('current stock: accepted package publishes once, following unchanged cycles skip processing',()=>{const r=runtime();r.run();assert.equal(r.writes(),1);assert.equal(r.props.get('PCC_INV_CURRENT_LOAD'),'load');r.run();assert.equal(r.writes(),1);assert.equal(r.calls(),1);});
test('current stock: incomplete movements never replace previous current inventory',()=>{const r=runtime();r.batch.coverage[0].complete=false;r.run();assert.equal(r.writes(),0);assert.equal(r.props.get('PCC_INV_CURRENT_STATUS'),'PENDIENTE_PAQUETE_COMPLETO');});
test('current stock: pending history publication postpones current views',()=>{const r=runtime();r.props.set('PCC_HIST_PUBLISHED_STATE','older');r.run();assert.equal(r.writes(),0);});
test('current stock: HTTP failure is not acknowledged and is retried',()=>{const r=runtime();r.fail();r.run();assert.equal(r.props.has('PCC_INV_CURRENT_LOAD'),false);assert.match(r.props.get('PCC_INV_CURRENT_STATUS'),/REVISAR/);r.run();assert.equal(r.writes(),2);});
test('current stock: near execution deadline defers without any write',()=>{const r=runtime();r.c.pccHistTrySyncCurrent_(Date.now()+1000);assert.equal(r.writes(),0);assert.equal(r.calls(),0);});
const html=fs.readFileSync('inventario_pt.html','utf8');const ui=vm.createContext({});vm.runInContext(html.slice(html.indexOf('function resumenExistencias('),html.indexOf('// ─── RESUMEN ───')),ui);
const stock=(total,extra={})=>({totalUds:total,u0:0,u1:0,u2:0,u3:0,c0:0,c1:0,c2:0,c3:0,cutoff:'2026-09-18',...extra});
test('dashboard: total includes seconds and collections even without age buckets',()=>{const r=ui.resumenExistencias([stock(147481),stock(10744,{esSeg:true}),stock(354,{esCobros:true})]);assert.equal(r.total,158579);assert.equal(r.principal+r.segundas+r.cobros,r.total);assert.equal(r.cutoff,'2026-09-18');});
test('dashboard: zero source stock never falls back to stale age quantities',()=>assert.equal(ui.resumenExistencias([stock(0,{u0:99})]).total,0));
test('dashboard: mixed cuts are not shown as a single certified cut',()=>assert.equal(ui.resumenExistencias([stock(1),stock(2,{cutoff:'2026-09-17'})]).cutoff,''));
const {patch}=require('../scripts/inventory-history/patch-legacy-cutoff.cjs');
test('legacy FIFO: optional cutoff replaces only the clock, preserving the manual default',()=>{
 const old="function calcularEdadFIFO(movTEX, movEU, invTEX, invEU) { var hoy     = new Date().getTime(); return hoy; }";
 const p=patch(old),c=vm.createContext({});vm.runInContext(p,c);
 assert.equal(c.calcularEdadFIFO(null,null,null,null,'2026-09-18'),Date.parse('2026-09-18T00:00:00-05:00'));
 assert.ok(Math.abs(c.calcularEdadFIFO()-Date.now())<2000);assert.throws(()=>patch(p),/cambió/);
});

test('timed entry point synchronizes current views on new and already accepted packages only',()=>{
 const {runtime}=require('./helpers/inventory-runtime.cjs'),r=runtime();let calls=0;r.ctx.pccHistTrySyncCurrent_=()=>calls++;
 r.ctx.procesarHistoricoPT();assert.equal(calls,0);r.declare();r.ctx.procesarHistoricoPT();assert.equal(calls,1);r.ctx.procesarHistoricoPT();assert.equal(calls,2);
});

test('current stock: same accepted load upgrades cost version once',()=>{const r=runtime();r.props.set('PCC_INV_CURRENT_LOAD','load');r.run();assert.equal(r.writes(),1);assert.equal(r.props.get('PCC_INV_COST_VERSION'),'1');r.run();assert.equal(r.writes(),1);});
test('current stock: cost upgrade waits for the new history publication version',()=>{const r=runtime();r.props.set('PCC_HIST_PUBLICATION_VERSION','2');r.run();assert.equal(r.writes(),0);assert.equal(r.props.get('PCC_INV_CURRENT_STATUS'),'ESPERANDO_PUBLICACION_HISTORICA');});
