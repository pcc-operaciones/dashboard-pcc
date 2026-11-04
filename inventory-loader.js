/* Current inventory reads: one network call, per-sheet freshness and bounded retry. */
(function(root){
 'use strict';
 const sheets=['INV_Resumen','INV_Bodegas','INV_Movimientos'];
 async function request(url,{fetcher=root.fetch.bind(root),sleep=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random,retries=3,timeout=20000}={}){
  for(let attempt=0;;attempt++){
   const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
   if(response.ok)return response.json();
   if(![429,503].includes(response.status)||attempt>=retries){
    const error=Error(response.status===429?'Google Sheets limitó las consultas (429). Espere un minuto antes de actualizar':'Error '+response.status+' al consultar inventario');
    error.status=response.status;throw error;
   }
   const retryAfter=response.headers?.get('Retry-After');
   const seconds=retryAfter===null||retryAfter===undefined?NaN:Number(retryAfter);
   const declared=Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-Date.now();
   await sleep(Math.min(60000,Math.max(1000*2**attempt+random()*500,Number.isFinite(declared)?declared:0)));
  }
 }
 async function current({base,id,key,load,request:read=request}){
  const params=new URLSearchParams({key,valueRenderOption:'UNFORMATTED_VALUE',_:String(Date.now())});
  sheets.forEach(sheet=>params.append('ranges',sheet+'!A:AZ'));
  // Start once; every consumer retains its own source/freshness record.
  const response=read(base+'/'+id+'/values:batchGet?'+params).then(data=>{
   if(!Array.isArray(data.valueRanges)||data.valueRanges.length!==sheets.length)throw Error('Respuesta de inventario incompleta');
   return data.valueRanges.map((range,i)=>{
    if(!String(range.range||'').replaceAll("'",'').startsWith(sheets[i]+'!'))throw Error('Rango de inventario inesperado');
    return range.values||[];
   });
  });
  const rows=await Promise.all(sheets.map((sheet,i)=>load(sheet+' · '+id.slice(-6),async()=>(await response)[i],{group:'inv',sheet})));
  const cuts=rows.flatMap(values=>{const col=values[0]?.indexOf('FECHA_CORTE_DATOS')??-1;return col<0?[]:values.slice(1).map(row=>row[col]);});
  if(new Set(cuts).size>1)throw Error('El inventario cambió durante la consulta. Pulse Actualizar para leer el mismo corte');
  return rows;
 }
 root.PccInventoryLoader={request,current};
 if(typeof module!=='undefined')module.exports=root.PccInventoryLoader;
})(typeof window!=='undefined'?window:globalThis);
