const {test}=require('node:test');
const assert=require('node:assert/strict');
const loader=require('../inventory-loader.js');
const sheets=['INV_Resumen','INV_Bodegas','INV_Movimientos'];
const payload=cuts=>({valueRanges:sheets.map((sheet,i)=>({range:sheet+'!A1:AZ2',values:[['FECHA_CORTE_DATOS','Valor_Conocido'],[cuts[i],1234.567]]}))});
const config={base:'https://example.test',id:'inventory',key:'test',load:(_,fn)=>fn()};

test('PT: consulta las tres fuentes en una llamada y conserva números crudos y trazabilidad',async()=>{
 let calls=0;const records=[];
 const result=await loader.current({...config,load:(name,fn,meta)=>{records.push({name,meta});return fn();},request:async url=>{
  calls++;const u=new URL(url);assert.equal(u.pathname,'/inventory/values:batchGet');assert.equal(u.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.deepEqual(u.searchParams.getAll('ranges'),sheets.map(s=>s+'!A:AZ'));return payload(Array(3).fill('2026-10-26'));
 }});
 assert.equal(calls,1);assert.equal(result[1][1][1],1234.567);assert.deepEqual(records.map(r=>r.meta),sheets.map(sheet=>({group:'inv',sheet})));
});
test('PT: rechaza cortes mezclados, rangos inesperados y respuestas incompletas',async()=>{
 await assert.rejects(loader.current({...config,request:async()=>payload(['2026-10-26','2026-10-27','2026-10-26'])}),/mismo corte/);
 await assert.rejects(loader.current({...config,request:async()=>({valueRanges:[]})}),/incompleta/);
 const data=payload(Array(3).fill('2026-10-26'));data.valueRanges.reverse();
 await assert.rejects(loader.current({...config,request:async()=>data}),/inesperado/);
});
test('PT: una fuente vacía no sustituye la respuesta por inventario anterior',async()=>{
 const result=await loader.current({...config,request:async()=>({valueRanges:sheets.map(sheet=>({range:sheet+'!A1:AZ1'}))})});
 assert.deepEqual(result,[[],[],[]]);
});
test('PT: un fallo de la consulta compartida se comunica a las tres fuentes',async()=>{
 const failures=[];await assert.rejects(loader.current({...config,load:async(name,fn)=>{try{return await fn();}catch(e){failures.push(name);throw e;}},request:async()=>{throw Error('503');}}),/503/);
 assert.equal(failures.length,3);
});
test('PT: 429/503 reintentan con espera creciente, sin perder la cancelación de la consulta',async()=>{
 const waits=[],statuses=[429,503,200];let calls=0;
 const result=await loader.request('https://example.test',{random:()=>0,sleep:async ms=>waits.push(ms),fetcher:async(_,options)=>{
  assert.equal(options.cache,'no-store');assert.ok(options.signal instanceof AbortSignal);const status=statuses[calls++];return {ok:status===200,status,headers:{get:()=>null},json:async()=>({ok:true})};
 }});
 assert.deepEqual(waits,[1000,2000]);assert.deepEqual(result,{ok:true});assert.equal(calls,3);
});
test('PT: respeta Retry-After y limita la cantidad de reintentos',async()=>{
 const waits=[];let calls=0;
 await assert.rejects(loader.request('https://example.test',{retries:2,random:()=>0,sleep:async ms=>waits.push(ms),fetcher:async()=>{calls++;return {ok:false,status:429,headers:{get:()=> '5'}};}}),e=>e.status===429&&/un minuto/.test(e.message));
 assert.equal(calls,3);assert.deepEqual(waits,[5000,5000]);
});
test('PT: no reintenta nombres de hoja inválidos ni consultas canceladas',async()=>{
 let calls=0;
 await assert.rejects(loader.request('https://example.test',{fetcher:async()=>{calls++;return {ok:false,status:400};}}),e=>e.status===400);
 assert.equal(calls,1);
 await assert.rejects(loader.request('https://example.test',{fetcher:async()=>{throw new DOMException('timeout','TimeoutError');}}),/timeout/);
});
