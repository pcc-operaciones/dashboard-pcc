/* Apps Script adapter. Add core.js to this project as a separate .gs file.
 * Requires Advanced Drive service v3. CurrentInventory updates INV_* from accepted cuts.
 * Optional OP sync delegates to the client's existing copier.
 * Configuration is kept in Script Properties, never in the public repository.
 */
function pccHistConfig_(){
 var value=PropertiesService.getScriptProperties().getProperty('PCC_HIST_CONFIG');
 if(!value)throw new Error('Falta la configuración inicial PCC_HIST_CONFIG. Ver guía de instalación.');
 var c=JSON.parse(value);
 if(!c.archiveFolderId||!c.files)throw new Error('Falta carpeta de archivo o fuentes.');
 ['invEU','invTEX','movEU','movTEX'].forEach(function(k){if(!c.files[k])throw new Error('Falta archivo '+k);});
 if(new Set(Object.values(c.files)).size!==4)throw new Error('Las cuatro fuentes deben ser archivos diferentes.');
 return c;
}
function pccHistHash_(bytes){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function pccHistTextHash_(s){return pccHistHash_(Utilities.newBlob(s).getBytes());}
function pccHistJson_(folder,name,value){return folder.createFile(Utilities.newBlob(JSON.stringify(value),'application/json',name));}
function pccHistNamed_(folder,name){var it=folder.getFilesByName(name);return it.hasNext()?it.next():null;}
function pccHistRead_(file){return JSON.parse(file.getBlob().getDataAsString('UTF-8'));}
function pccHistState_(){var id=PropertiesService.getScriptProperties().getProperty('PCC_HIST_STATE_FILE');return id?pccHistRead_(DriveApp.getFileById(id)):null;}
function pccHistStatus_(status,detail){PropertiesService.getScriptProperties().setProperty('PCC_HIST_STATUS',JSON.stringify({status:status,detail:detail||'',checkedAt:new Date().toISOString()}));}
function pccHistSources_(config){
 return ['invEU','invTEX','movEU','movTEX'].map(function(role){
  var f=DriveApp.getFileById(config.files[role]);
  var before=f.getLastUpdated().getTime(),name=f.getName(),description=f.getDescription()||'',blob=f.getBlob();
  if(before!==f.getLastUpdated().getTime())throw new Error('Archivo cambiando durante la lectura: '+role);
  var hash=pccHistHash_(blob.getBytes());
  return {role:role,id:f.getId(),name:name,description:description,modified:before,blob:blob,hash:hash};
 });
}
function pccHistUnchanged_(sources){
 return sources.every(function(s){var f=DriveApp.getFileById(s.id);return f.getLastUpdated().getTime()===s.modified&&f.getName()===s.name&&(f.getDescription()||'')===s.description;});
}
function pccHistRows_(raw,role,folder){
 var saved=pccHistNamed_(folder,role+'.json');if(saved)return pccHistRead_(saved);
 var temporary;
 try{
  var converted=Drive.Files.create({name:'PCC_TEMP_'+Utilities.getUuid(),mimeType:'application/vnd.google-apps.spreadsheet',parents:[folder.getId()]},raw.getBlob(),{fields:'id'});
  temporary=converted.id;
  var book;
  for(var attempt=0;attempt<3;attempt++){try{book=SpreadsheetApp.openById(temporary);break;}catch(e){if(attempt===2)throw e;Utilities.sleep(1500);}}
  var rows=book.getSheets()[0].getDataRange().getValues();
  var tz=book.getSpreadsheetTimeZone();
  rows=rows.map(function(row){return row.map(function(v){return v instanceof Date?Utilities.formatDate(v,tz,'yyyy-MM-dd'):v;});});
  pccHistJson_(folder,role+'.json',rows);return rows;
 }finally{if(temporary)DriveApp.getFileById(temporary).setTrashed(true);}
}
function procesarHistoricoPT(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 var t0=Date.now();
 try{
  if(typeof pccHistSyncPendingOps_==='function')pccHistSyncPendingOps_();
  // Reserve enough of the six-minute execution for inventory processing.
  if(Date.now()-t0>90000){pccHistStatus_('CONTINUAR_SIGUIENTE_EJECUCION','Revisión de OP realizada; inventario continuará en el siguiente ciclo.');return;}
  var c=pccHistConfig_(),props=PropertiesService.getScriptProperties(),folder=DriveApp.getFolderById(c.archiveFolderId),sources=pccHistSources_(c);
  var quietMinutes=c.quietMinutes===undefined?10:Number(c.quietMinutes);
  if(sources.some(function(s){return Date.now()-s.modified<quietMinutes*60000;})){pccHistStatus_('ESPERANDO_ARCHIVOS_ESTABLES');return;}
  if(!pccHistUnchanged_(sources)){pccHistStatus_('ESPERANDO_PAQUETE_ESTABLE');return;}
  var declaration=JSON.parse(props.getProperty('PCC_HIST_DECLARATION')||'null');
  if(declaration&&!pccHistDeclarationMatches_(sources,declaration))declaration=null;
  var identity=sources.map(function(s){return {role:s.role,id:s.id,name:s.name,description:s.description,hash:s.hash};});
  var loadId=pccHistTextHash_(JSON.stringify({sources:identity,declaration:declaration})),state=pccHistState_();
  if(state&&state.loads.some(function(l){return l.id===loadId;})){pccHistStatus_('SIN_CAMBIOS');if(typeof pccHistTryPublish_==='function')pccHistTryPublish_(t0+220000);if(typeof pccHistTrySyncCurrent_==='function')pccHistTrySyncCurrent_(t0+310000);return;}
  var folders=folder.getFoldersByName('PCC_LOTE_'+loadId),batchFolder=folders.hasNext()?folders.next():folder.createFolder('PCC_LOTE_'+loadId);
  // Preserve originals even if dates or completeness controls are still missing.
  sources.forEach(function(s){var name=s.role+'.xlsx',raw=pccHistNamed_(batchFolder,name);if(!raw)raw=batchFolder.createFile(s.blob.copyBlob().setName(name));if(pccHistHash_(raw.getBlob().getBytes())!==s.hash)throw new Error('El respaldo no coincide: '+s.role);});
  if(!pccHistNamed_(batchFolder,'fuentes.json'))pccHistJson_(batchFolder,'fuentes.json',{identity:identity,capturedAt:new Date().toISOString()});
  var files={};
  sources.forEach(function(s){files[s.role]={hash:s.hash,meta:declaration?declaration.meta[s.role]:PccInventoryHistory.metadata(s.name,s.description,s.hash)};});
  if(!files.invEU.meta.cutoff||!files.invTEX.meta.cutoff||!files.movEU.meta.from||!files.movEU.meta.to||!files.movTEX.meta.from||!files.movTEX.meta.to){pccHistStatus_('RESPALDADO_PENDIENTE_FECHAS','Los originales están conservados. Faltan corte de inventarios o período exportado. Lote '+loadId);return;}
  for(var i=0;i<sources.length;i++){
   if(Date.now()-t0>240000){pccHistStatus_('CONTINUAR_SIGUIENTE_EJECUCION',loadId);return;}
   var s=sources[i];files[s.role].rows=pccHistRows_(pccHistNamed_(batchFolder,s.role+'.xlsx'),s.role,batchFolder);
  }
  var batch=PccInventoryHistory.prepare(files,{today:Utilities.formatDate(new Date(),'America/Bogota','yyyy-MM-dd'),startCutoff:state&&state.startCutoff,rowLimit:c.erpRowLimit});
  if(!pccHistUnchanged_(sources)){pccHistStatus_('ARCHIVOS_CAMBIARON','Respaldo conservado; esperar a que termine la carga.');return;}
  var canonical=pccHistNamed_(batchFolder,'corte.json');if(!canonical)canonical=pccHistJson_(batchFolder,'corte.json',batch);
  var next=PccInventoryHistory.accept(state,batch,loadId,new Date().toISOString());
  var entry=next.loads.find(function(l){return l.id===loadId;});entry.folderId=batchFolder.getId();entry.dataId=canonical.getId();
  // A new state file is complete and read back before a single pointer is changed.
  // Never overwrite the previous accepted state. Current views publish separately.
  var stateFile=pccHistJson_(folder,'PCC_ESTADO_'+Utilities.getUuid()+'.json',next);
  var check=pccHistRead_(stateFile);if(!check.loads.some(function(l){return l.id===loadId&&l.dataId===canonical.getId();}))throw new Error('No se pudo verificar el estado guardado.');
  props.setProperty('PCC_HIST_STATE_FILE',stateFile.getId());
  pccHistStatus_('CARGA_CONSERVADA',batch.cutoff+' · '+entry.status);
  if(typeof pccHistTryPublish_==='function')pccHistTryPublish_(t0+220000);
  if(typeof pccHistTrySyncCurrent_==='function')pccHistTrySyncCurrent_(t0+310000);
 }catch(e){pccHistStatus_('REVISAR_CARGA',String(e.message||e).slice(0,500));throw e;}
 finally{lock.releaseLock();}
}
function estadoHistoricoPT(){var props=PropertiesService.getScriptProperties(),v=props.getProperty('PCC_HIST_STATUS');Logger.log(v||'Sin ejecuciones.');if(!v)return null;var state=JSON.parse(v);state.publication=props.getProperty('PCC_HIST_PUBLICATION_STATUS')||'Consulta histórica pendiente';state.currentInventory=props.getProperty('PCC_INV_CURRENT_STATUS')||'Pendiente';state.pendingOps=JSON.parse(props.getProperty('PCC_OP_NR_STATUS')||'null');return state;}
function instalarTriggerHistoricoPT(){
 pccHistConfig_();
 if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='procesarHistoricoPT';}))ScriptApp.newTrigger('procesarHistoricoPT').timeBased().everyMinutes(15).create();
}
// One form per package: ERP does not export its selection dates.
function pccHistDeclarationMatches_(sources,d){return !!d&&sources.every(function(s){var x=d.sources[s.role];return x&&x.id===s.id&&x.hash===s.hash;});}
function datosFormularioHistoricoPT(){
 var c=pccHistConfig_(),sources=pccHistSources_(c),mapped={};
 sources.forEach(function(s){mapped[s.role]={id:s.id,hash:s.hash};});
 return {fingerprint:pccHistTextHash_(JSON.stringify(mapped)),files:sources.map(function(s){return {role:s.role,name:s.name};})};
}
function registrarCargaHistoricaPT(form){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))throw new Error('Hay una carga en proceso. Intenta de nuevo al finalizar.');
 try{
  var c=pccHistConfig_(),sources=pccHistSources_(c),mapped={};sources.forEach(function(s){mapped[s.role]={id:s.id,hash:s.hash};});
  if(pccHistTextHash_(JSON.stringify(mapped))!==form.fingerprint||!pccHistUnchanged_(sources))throw new Error('Los archivos cambiaron mientras completabas el formulario. Vuelve a abrirlo.');
  var cutoff=PccInventoryHistory.date(form.cutoff),from=PccInventoryHistory.date(form.from),to=PccInventoryHistory.date(form.to);
  if(from>to||to>cutoff||cutoff>Utilities.formatDate(new Date(),'America/Bogota','yyyy-MM-dd'))throw new Error('Revisa las fechas: inicio ≤ fin de movimientos ≤ corte de inventario ≤ hoy.');
  var declaration={sources:mapped,meta:{}};
  ['EU','TEX'].forEach(function(company){declaration.meta['inv'+company]={cutoff:cutoff,complete:form.complete===true};declaration.meta['mov'+company]={from:from,to:to,complete:form.complete===true};});
  PropertiesService.getScriptProperties().setProperty('PCC_HIST_DECLARATION',JSON.stringify(declaration));
  pccHistStatus_('FECHAS_REGISTRADAS','La siguiente ejecución procesará el paquete.');
  return {message:'Fechas guardadas para estos cuatro archivos. El proceso automático conservará la carga.'};
 }finally{lock.releaseLock();}
}
function abrirCargaHistoricaPT(){SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('CargaHistorica').setTitle('Registrar carga de inventario'));}
function menuHistoricoPT(){SpreadsheetApp.getUi().createMenu('Histórico PT').addItem('Registrar fechas de la carga','abrirCargaHistoricaPT').addItem('Procesar paquete','procesarHistoricoPT').addItem('Ver estado','mostrarEstadoHistoricoPT').addToUi();}
function mostrarEstadoHistoricoPT(){var s=estadoHistoricoPT();SpreadsheetApp.getUi().alert(s?s.status+'\n'+s.detail+'\n\nConsulta del dashboard: '+s.publication+'\n\nInventario actual: '+s.currentInventory+(s.pendingOps?'\n\nOP no recibidas: '+s.pendingOps.status+'\n'+s.pendingOps.detail:''):'Sin ejecuciones.');}
