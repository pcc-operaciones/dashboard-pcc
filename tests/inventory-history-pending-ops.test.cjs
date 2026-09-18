const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const {runtime}=require('./helpers/inventory-runtime.cjs');
function setup(){
 const props=new Map([['PCC_OP_NR_SOURCE_ID','source']]);let modified=Date.now()-1200000,calls=0,id=1,failure=false,write=true,changeDuring=false;
 const makeSheet=(sid,note)=>({getSheetId:()=>sid,getLastRow:()=>38,getRange:()=>({getNote:()=>note})});
 let sheet=makeSheet(id,'old');
 const service={getProperty:k=>props.get(k)||null,setProperty(k,v){props.set(k,v);return service;}};
 const context=vm.createContext({console:{error(){}},CFG:{OUTPUT_ID:'out'},PropertiesService:{getScriptProperties:()=>service},
  DriveApp:{getFileById:()=>({getLastUpdated:()=>new Date(modified)})},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},
  copiarOpNoRecibida(){calls++;if(failure)throw Error('source unavailable');if(write)sheet=makeSheet(++id,'new');if(changeDuring)modified++;}});
 vm.runInContext(fs.readFileSync('apps-script/inventory-history/PendingOps.gs','utf8'),context);
 return {context,props,run:()=>context.pccHistSyncPendingOps_(),calls:()=>calls,status:()=>JSON.parse(props.get('PCC_OP_NR_STATUS')),touch:()=>modified++,unstable:()=>modified=Date.now(),fail:()=>failure=true,noWrite:()=>write=false,changeDuring:()=>changeDuring=true};
}
test('OP: invokes the existing copier once and only repeats after a source change',()=>{const r=setup();r.run();assert.equal(r.calls(),1);assert.equal(r.status().status,'ACTUALIZADO');r.run();assert.equal(r.calls(),1);r.touch();r.run();assert.equal(r.calls(),2);});
test('OP: a failed copy is visible and retried without certifying its version',()=>{const r=setup();r.fail();r.run();assert.equal(r.status().status,'REVISAR_OP_NO_RECIBIDAS');assert.equal(r.props.has('PCC_OP_NR_VERSION'),false);r.run();assert.equal(r.calls(),2);});
test('OP: recently changed input is allowed to settle before copying',()=>{const r=setup();r.unstable();r.run();assert.equal(r.calls(),0);assert.equal(r.status().status,'ESPERANDO_ARCHIVO_ESTABLE');});
test('OP: disabled configuration does not call or change the original process',()=>{const r=setup();r.props.delete('PCC_OP_NR_SOURCE_ID');r.run();assert.equal(r.calls(),0);assert.equal(r.props.has('PCC_OP_NR_STATUS'),false);});
test('OP: original no-write behavior is distinguished from a fresh publication',()=>{const r=setup();r.noWrite();r.run();assert.equal(r.status().status,'SIN_ESCRITURA');r.run();assert.equal(r.calls(),1);});
test('OP: input changed during copy cannot be acknowledged as the accepted version',()=>{const r=setup();r.changeDuring();r.run();assert.equal(r.status().status,'REVISAR_OP_NO_RECIBIDAS');assert.equal(r.props.has('PCC_OP_NR_VERSION'),false);});
test('OP: the timed entry point checks OP even when inventory dates are missing or unchanged',()=>{const r=runtime();let calls=0;r.ctx.pccHistSyncPendingOps_=()=>calls++;r.ctx.procesarHistoricoPT();assert.equal(r.status().status,'RESPALDADO_PENDIENTE_FECHAS');assert.equal(calls,1);r.declare();r.ctx.procesarHistoricoPT();r.ctx.procesarHistoricoPT();assert.equal(r.status().status,'SIN_CAMBIOS');assert.equal(calls,3);});
test('OP: copier errors do not prevent an inventory archive from being accepted',()=>{const r=runtime();r.ctx.CFG={OUTPUT_ID:'out'};r.ctx.copiarOpNoRecibida=()=>{};r.props.set('PCC_OP_NR_SOURCE_ID','unavailable');vm.runInContext(fs.readFileSync('apps-script/inventory-history/PendingOps.gs','utf8'),r.ctx);r.declare();r.ctx.procesarHistoricoPT();assert.equal(r.state().loads.length,1);assert.equal(JSON.parse(r.props.get('PCC_OP_NR_STATUS')).status,'REVISAR_OP_NO_RECIBIDAS');});
