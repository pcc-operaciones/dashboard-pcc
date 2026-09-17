const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');

function runtime(){
 const objects=new Map(),folders=new Map(),props=new Map(),sheets=new Map();let id=0,conversions=0,fault=null,onConvert=null;
 const makeBlob=(bytes,name='')=>({getBytes:()=>Array.from(Buffer.from(bytes)),getDataAsString:()=>Buffer.from(bytes).toString('utf8'),copyBlob:()=>makeBlob(bytes,name),setName(n){name=n;return this;},getName:()=>name});
 function file(name,bytes){const f={id:String(++id),name,bytes:Buffer.from(bytes),description:'',modified:Date.now()-1200000,getId(){return this.id;},getName(){return this.name;},getDescription(){return this.description;},getLastUpdated(){return new Date(this.modified);},getBlob(){return makeBlob(this.bytes,this.name);},setTrashed(v){this.trashed=v;}};objects.set(f.id,f);return f;}
 const iterator=a=>{let n=0;return {hasNext:()=>n<a.length,next:()=>a[n++]};};
 function folder(name){const f={id:String(++id),name,files:[],folders:[],getId(){return this.id;},getFilesByName(n){return iterator(this.files.filter(x=>x.name===n&&!x.trashed));},getFoldersByName(n){return iterator(this.folders.filter(x=>x.name===n));},createFolder(n){const sub=folder(n);this.folders.push(sub);return sub;},createFile(blob){if(fault&&blob.getName().startsWith(fault))throw Error('Fallo simulado de escritura');const x=file(blob.getName(),blob.getBytes());this.files.push(x);return x;}};folders.set(f.id,f);return f;}
 const inv=[['Referencia','Desc. item','Detalle ext. 2','Detalle ext. 1','Bodega','Existencia','Cant. comprometida','Cant. disponible'],['001','Prenda','M','01','PT001',10,2,8]];
 const mov=[['Referencia','Detalle ext. 2','Detalle ext. 1','Bodega','Fecha','Tipo docto.','Entradas (inv.)','Salidas (inv.)','Neto (inv.)','Costo entradas (prom.)','Costo salidas (prom.)','Costo neto (prom.)'],['001','M','01','PT001','2026-09-10','ENS',8,3,5,200,75,125]];
 function sheet(name){
  const cells=new Map();let max=1000;
  const api={getLastRow:()=>Math.max(0,...[...cells.keys()].map(k=>+k.split(',')[0])),getMaxRows:()=>max,insertRowsAfter:(n,count)=>{max+=count;},getRange(row,col,height=1,width=1){
   const range={setValues(values){if(fault===name)throw Error('Fallo simulado de hoja');values.forEach((r,i)=>r.forEach((v,j)=>cells.set([row+i,col+j].join(','),v)));return range;},getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>cells.get([row+i,col+j].join(','))??'')),setValue(v){return range.setValues([[v]]);},getValue(){return range.getValues()[0][0];}};return range;
  }};sheets.set(name,api);return api;
 }
 const book={getSheetByName:n=>sheets.get(n),insertSheet:sheet};
 const source={},cfg={archiveFolderId:folder('archive').id,files:{},quietMinutes:0};
 for(const role of ['invEU','invTEX','movEU','movTEX']){source[role]=file(role+'.xlsx',JSON.stringify(role.startsWith('inv')?inv:mov));cfg.files[role]=source[role].id;}
 props.set('PCC_HIST_CONFIG',JSON.stringify(cfg));const svc={getProperty:k=>props.get(k)||null,setProperty(k,v){props.set(k,v);return svc;}};
 const ctx=vm.createContext({console,Logger:{log(){}},PropertiesService:{getScriptProperties:()=>svc},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{newBlob:(s,mime,name)=>makeBlob(s,name),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(a,b)=>Array.from(crypto.createHash('sha256').update(Buffer.from(b)).digest()),formatDate:()=> '2026-09-16',getUuid:()=>String(++id),sleep(){}},DriveApp:{getFileById:id=>objects.get(id),getFolderById:id=>folders.get(id)},Drive:{Files:{create(meta,blob){conversions++;if(onConvert)onConvert();return {id:file(meta.name,blob.getBytes()).id};}}},SpreadsheetApp:{flush(){},openById:id=>id==='output'?book:({getSheets:()=>[{getDataRange:()=>({getValues:()=>JSON.parse(objects.get(id).bytes.toString())})}],getSpreadsheetTimeZone:()=> 'America/Bogota'})}});
 vm.runInContext(fs.readFileSync('scripts/inventory-history/core.js','utf8'),ctx);vm.runInContext(fs.readFileSync('apps-script/inventory-history/Code.gs','utf8'),ctx);
 vm.runInContext(fs.readFileSync('inventory-history-model.js','utf8'),ctx);vm.runInContext(fs.readFileSync('apps-script/inventory-history/Publication.gs','utf8'),ctx);
 function declare(complete=true){const f=ctx.datosFormularioHistoricoPT();return ctx.registrarCargaHistoricaPT({fingerprint:f.fingerprint,cutoff:'2026-09-16',from:'2026-09-01',to:'2026-09-16',complete});}
 return {ctx,props,source,declare,book,objects,enablePublication(){cfg.querySheetId='output';props.set('PCC_HIST_CONFIG',JSON.stringify(cfg));},conversions:()=>conversions,setFault:f=>fault=f,setOnConvert:f=>onConvert=f,state:()=>ctx.pccHistState_(),status:()=>JSON.parse(props.get('PCC_HIST_STATUS')),archive:folders.get(cfg.archiveFolderId)};
}
module.exports={runtime};
