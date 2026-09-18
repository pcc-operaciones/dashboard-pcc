/* Reuse the client's existing copier, without changing its report rules.
 * Configure PCC_OP_NR_SOURCE_ID with the same source as copiarOpNoRecibida.
 * Runs independently of the four-file inventory declaration.
 */
function pccHistSyncPendingOps_(){
 var props=PropertiesService.getScriptProperties(),sourceId=props.getProperty('PCC_OP_NR_SOURCE_ID');
 if(!sourceId)return;
 function status(code,detail){props.setProperty('PCC_OP_NR_STATUS',JSON.stringify({status:code,detail:detail||'',checkedAt:new Date().toISOString()}));}
 try{
  if(typeof copiarOpNoRecibida!=='function'||typeof CFG==='undefined'||!CFG.OUTPUT_ID)throw new Error('Falta la función original o su hoja de destino.');
  var source=DriveApp.getFileById(sourceId),modified=source.getLastUpdated().getTime();
  var version=sourceId+':'+modified;
  if(Date.now()-modified<600000){status('ESPERANDO_ARCHIVO_ESTABLE','El informe de OP debe llevar 10 minutos sin cambios.');return;}
  var book=SpreadsheetApp.openById(CFG.OUTPUT_ID),before=book.getSheetByName('OP_NO_RECIBIDA_BPT');
  if(props.getProperty('PCC_OP_NR_VERSION')===version&&before)return;
  var beforeId=before?before.getSheetId():null,beforeNote=before?before.getRange('A1').getNote():null;
  copiarOpNoRecibida();
  SpreadsheetApp.flush();
  if(source.getLastUpdated().getTime()!==modified)throw new Error('El informe cambió durante la copia; se volverá a revisar.');
  var after=book.getSheetByName('OP_NO_RECIBIDA_BPT');
  if(!after||after.getLastRow()<1)throw new Error('La función original no dejó una hoja de destino verificable.');
  // The original copier returns without writing when its result has no rows.
  // Preserve that behavior; never claim that the previous sheet is a fresh copy.
  var wrote=after.getSheetId()!==beforeId||after.getRange('A1').getNote()!==beforeNote;
  var result={status:wrote?'ACTUALIZADO':'SIN_ESCRITURA',
   detail:wrote?(Math.max(0,after.getLastRow()-1)+' OP copiadas por la función original.'):'La función original no escribió filas; se conserva su comportamiento y la hoja anterior.',
   sourceModifiedAt:new Date(modified).toISOString(),checkedAt:new Date().toISOString()};
  props.setProperty('PCC_OP_NR_RESULT',JSON.stringify(result));
  props.setProperty('PCC_OP_NR_VERSION',version);
  props.setProperty('PCC_OP_NR_STATUS',JSON.stringify(result));
 }catch(e){status('REVISAR_OP_NO_RECIBIDAS',String(e.message||e).slice(0,400));console.error('OP pendientes de recepción: '+String(e.message||e));}
}
