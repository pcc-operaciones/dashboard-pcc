/* Optional installer for an existing client-owned, container-bound project.
 * Uses its existing CFG; does not call or modify the production processor.
 */
function configurarPilotoHistoricoPT(){
 var lock=LockService.getScriptLock();
 if(!lock.tryLock(1000))throw new Error('Hay una operación en curso. Intenta de nuevo al finalizar.');
 try{
  if(typeof CFG==='undefined'||!CFG.OUTPUT_ID)throw new Error('Este instalador requiere la configuración CFG del proyecto original.');
  var destination=DriveApp.getFileById(CFG.OUTPUT_ID),owner=destination.getOwner();
  var account=Session.getEffectiveUser().getEmail();
  if(!owner||!account||owner.getEmail().toLowerCase()!==account.toLowerCase())throw new Error('Ejecuta esta configuración desde la cuenta propietaria de la hoja del cliente. Así los respaldos y activadores quedan bajo su cuenta.');
  var props=PropertiesService.getScriptProperties(),existing=props.getProperty('PCC_HIST_CONFIG');
  if(existing){
   var current=pccHistConfig_();
   DriveApp.getFolderById(current.archiveFolderId).getName();
  }else{
   var files={invEU:CFG.XLSX_INVENTARIO_EU,invTEX:CFG.XLSX_INVENTARIO_TEX,movEU:CFG.XLSX_MOVIMIENTOS_EU,movTEX:CFG.XLSX_MOVIMIENTOS_TEX};
   if(Object.values(files).some(function(id){return !id;})||new Set(Object.values(files)).size!==4)throw new Error('Revisa los cuatro ID de Excel en CFG.');
   Object.values(files).forEach(function(id){DriveApp.getFileById(id).getName();});
   var folderId=props.getProperty('PCC_HIST_ARCHIVE_FOLDER');
   if(!folderId){folderId=DriveApp.createFolder('PCC - Historico Inventario PT').getId();props.setProperty('PCC_HIST_ARCHIVE_FOLDER',folderId);}
   DriveApp.getFolderById(folderId).getName();
   props.setProperty('PCC_HIST_CONFIG',JSON.stringify({archiveFolderId:folderId,files:files,quietMinutes:10,erpRowLimit:null}));
  }
  // Only an open-menu trigger. Import scheduling follows the first valid pilot load.
  if(!ScriptApp.getProjectTriggers().some(function(t){return t.getHandlerFunction()==='menuHistoricoPT';}))ScriptApp.newTrigger('menuHistoricoPT').forSpreadsheet(CFG.OUTPUT_ID).onOpen().create();
  menuHistoricoPT();
  Logger.log('Piloto configurado. En la hoja abre Historico PT > Registrar fechas de la carga. No se ha activado la importacion periodica ni cambiado el tablero.');
  return {status:'PILOTO_CONFIGURADO',periodicImportEnabled:false};
 }finally{lock.releaseLock();}
}
