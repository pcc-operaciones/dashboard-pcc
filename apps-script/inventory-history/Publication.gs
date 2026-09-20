/* Publish a minimal query feed into the dashboard's existing Sheet.
 * Append-only payloads, verified before changing one manifest cell.
 * Raw Excel, source hashes/IDs and the archival state remain private.
 */
function pccHistAppendQuery_(sheet,value){
 var json=JSON.stringify(value),rows=[];
 for(var i=0;i<json.length;){var end=Math.min(i+28000,json.length);if(end<json.length&&json.charCodeAt(end-1)>=0xD800&&json.charCodeAt(end-1)<=0xDBFF)end--;rows.push(['j'+json.slice(i,end)]);i=end;}
 var first=Math.max(2,sheet.getLastRow()+1),last=first+rows.length-1;
 if(last>250000)throw new Error('La tabla histórica requiere ampliar almacenamiento. El archivo privado sigue conservado.');
 if(last>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),last-sheet.getMaxRows());
 sheet.getRange(first,1,rows.length,1).setValues(rows);SpreadsheetApp.flush();
 var read=sheet.getRange(first,1,rows.length,1).getValues().map(function(r){return String(r[0]).slice(1);}).join('');
 if(read!==json)throw new Error('No se pudo verificar la tabla histórica; se conserva la publicación anterior.');
 return {row:first,count:rows.length,hash:pccHistTextHash_(json)};
}
function pccHistPublish_(deadline){
 var c=pccHistConfig_(),output=c.querySheetId||(typeof CFG!=='undefined'&&CFG.OUTPUT_ID);
 if(!output)return; // Standalone pilot remains archive-only until configured.
 var props=PropertiesService.getScriptProperties(),stateId=props.getProperty('PCC_HIST_STATE_FILE');
 if(!stateId||(props.getProperty('PCC_HIST_PUBLISHED_STATE')===stateId&&props.getProperty('PCC_HIST_PUBLICATION_VERSION')==='3'))return;
 var state=pccHistState_(),folder=DriveApp.getFolderById(c.archiveFolderId),cacheId=props.getProperty('PCC_HIST_QUERY_FILE');
 var q=cacheId?pccHistRead_(DriveApp.getFileById(cacheId)):null;
 // Rebuild from preserved batches once; never mutate or delete the original archive.
 if(q&&q.publicationVersion!==3)q=null;
 var book=SpreadsheetApp.openById(output),sheet=book.getSheetByName('INV_Hist_Datos')||book.insertSheet('INV_Hist_Datos');
 for(var i=0;i<state.loads.length;i++){
  var load=state.loads[i];if(q&&q.processed.indexOf(load.id)>=0)continue;
  if(Date.now()>deadline){props.setProperty('PCC_HIST_PUBLICATION_STATUS','CONTINUAR_PUBLICACION');return;}
  var batch=pccHistValuedBatch_(load,pccHistRead_(DriveApp.getFileById(load.dataId)));
  var next=PccHistoryModel.apply(q,batch,load.id,state.startCutoff);
  next.publicationVersion=3;
  if(batch.inventoryComplete){
   var detail={schema:1,cutoff:batch.cutoff,rows:PccHistoryModel.groupStock(batch.inventory),rotation:PccHistoryModel.rotationSnapshot(batch)};
   next.cuts.find(function(x){return x.id===load.id;}).detail=pccHistAppendQuery_(sheet,detail);
  }
  // Checkpoint only after verified detail. A failed run can leave unreferenced rows,
  // but cannot point readers to incomplete payloads or destroy an accepted cut.
  var saved=pccHistJson_(folder,'PCC_CONSULTA_'+Utilities.getUuid()+'.json',next);
  if(pccHistRead_(saved).processed.indexOf(load.id)<0)throw new Error('Consulta privada no verificada.');
  props.setProperty('PCC_HIST_QUERY_FILE',saved.getId());q=next;
 }
 if(!q||!q.cuts.length)return;
 var publicQuery={schema:1,startCutoff:q.startCutoff,cuts:q.cuts.map(function(cut){return {cutoff:cut.cutoff,summary:cut.summary,detail:cut.detail};}),ledger:q.ledger,coverage:q.coverage};
 var descriptor=pccHistAppendQuery_(sheet,publicQuery);
 var manifest=book.getSheetByName('INV_Hist_Control')||book.insertSheet('INV_Hist_Control');
 manifest.getRange(1,1).setValue(JSON.stringify({schema:1,...descriptor}));SpreadsheetApp.flush();
 if(manifest.getRange(1,1).getValue()!==JSON.stringify({schema:1,...descriptor}))throw new Error('No se pudo verificar el índice público.');
 props.setProperty('PCC_HIST_PUBLISHED_STATE',stateId);
 props.setProperty('PCC_HIST_PUBLICATION_VERSION','3');
 props.setProperty('PCC_HIST_PUBLICATION_STATUS','PUBLICADO · '+q.cuts.length+' cortes · '+q.cuts[q.cuts.length-1].cutoff);
}
function pccHistTryPublish_(deadline){
 try{pccHistPublish_(deadline);}catch(e){
  PropertiesService.getScriptProperties().setProperty('PCC_HIST_PUBLICATION_STATUS','REVISAR_PUBLICACION · '+String(e.message||e).slice(0,400));
  console.error('Consulta histórica pendiente: '+String(e.message||e));
 }
}
function publicarConsultaHistoricoPT(){
 var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{pccHistPublish_(Date.now()+220000);Logger.log(PropertiesService.getScriptProperties().getProperty('PCC_HIST_PUBLICATION_STATUS'));}
 finally{lock.releaseLock();}
}
