/* Refresh legacy inventory views from the SAME accepted, archived package.
 * Reuse the client's transformation functions; never reconvert the live Excel.
 * All three tables are reconciled before one atomic Sheets publication.
 */
function pccHistCurrentGroups_(rows,headers){
 var result={};
 rows.forEach(function(r){
  var company=headers?r[headers.indexOf('Empresa')]:r.company;
  var ref=headers?r[headers.indexOf('Referencia')]:r.ref;
  var warehouse=headers?r[headers.indexOf('Bodega')]:r.warehouse;
  var units=Number(headers?r[headers.indexOf('Total_Uds')]:r.units);
  if(!Number.isFinite(units))throw new Error('Existencias no numéricas.');
  var key=JSON.stringify([String(company),String(ref),String(warehouse)]);
  result[key]=(result[key]||0)+units;
 });
 return result;
}
function pccHistReconcileCurrent_(table,inventory,label){
 ['Empresa','Referencia','Bodega','Total_Uds'].forEach(function(h){if(table[0].indexOf(h)<0)throw new Error('Falta '+h+' en '+label);});
 var expected=pccHistCurrentGroups_(inventory),actual=pccHistCurrentGroups_(table.slice(1),table[0]);
 Object.keys(Object.assign({},expected,actual)).forEach(function(k){
  if(Math.abs((expected[k]||0)-(actual[k]||0))>0.000001)throw new Error(label+' no coincide con el histórico en '+k);
 });
}
function pccHistCurrentDates_(table,batch){
 var update=table[0].indexOf('Fecha_Actualizacion');
 var extra=['FECHA_CORTE_DATOS','MOVIMIENTOS_DESDE','MOVIMIENTOS_HASTA'];
 var coverage={};batch.coverage.forEach(function(c){coverage[c.company]=c;});
 var company=table[0].indexOf('Empresa');
 table[0]=table[0].concat(extra);
 for(var i=1;i<table.length;i++){
  var cov=coverage[table[i][company]];
  // Source freshness means the declared ERP cut, never today's processing time.
  if(update>=0)table[i][update]=batch.cutoff;
  table[i]=table[i].concat([batch.cutoff,cov.from,cov.to]);
 }
 return table;
}
function pccHistCurrentRequests_(book,tables,cutoff){
 var requests=[];
 tables.forEach(function(t){
  var sheet=book.getSheetByName(t.name);
  if(!sheet)throw new Error('Falta la hoja de destino '+t.name);
  var id=sheet.getSheetId(),width=t.rows[0].length,height=t.rows.length;
  if(height>sheet.getMaxRows())requests.push({appendDimension:{sheetId:id,dimension:'ROWS',length:height-sheet.getMaxRows()}});
  if(width>sheet.getMaxColumns())requests.push({appendDimension:{sheetId:id,dimension:'COLUMNS',length:width-sheet.getMaxColumns()}});
  requests.push({updateCells:{range:{sheetId:id,startRowIndex:0,startColumnIndex:0,endRowIndex:Math.max(height,sheet.getLastRow()),endColumnIndex:Math.max(width,sheet.getLastColumn())},
   rows:t.rows.map(function(row){return {values:row.map(function(v){
    if(v===null||v===undefined||v==='')return {};
    if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Número inválido en '+t.name);return {userEnteredValue:{numberValue:v}};}
    return {userEnteredValue:{stringValue:String(v)}};
   })};}),fields:'userEnteredValue'}});
  requests.push({updateCells:{range:{sheetId:id,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1},rows:[{values:[{note:'Corte ERP: '+cutoff+' · Publicado: '+new Date().toISOString()}]}],fields:'note'}});
 });
 return requests;
}
function pccHistSyncCurrent_(deadline){
 if(typeof CFG==='undefined'||!CFG.OUTPUT_ID)return;
 var props=PropertiesService.getScriptProperties(),state=pccHistState_();
 if(!state||!state.current)return;
 var load=state.loads.find(function(l){return l.id===state.current.id;});
 if(!load||(props.getProperty('PCC_INV_CURRENT_LOAD')===load.id&&props.getProperty('PCC_INV_COST_VERSION')==='1'))return;
 if(props.getProperty('PCC_HIST_PUBLISHED_STATE')!==props.getProperty('PCC_HIST_STATE_FILE')||props.getProperty('PCC_HIST_PUBLICATION_VERSION')!=='3'){
  props.setProperty('PCC_INV_CURRENT_STATUS','ESPERANDO_PUBLICACION_HISTORICA');return;
 }
 if(Date.now()+90000>deadline){props.setProperty('PCC_INV_CURRENT_STATUS','CONTINUAR_SIGUIENTE_EJECUCION');return;}
 var batch=pccHistValuedBatch_(load,pccHistRead_(DriveApp.getFileById(load.dataId)));
 if(!batch.inventoryComplete||!['EU','TEX'].every(function(co){return batch.coverage.some(function(c){return c.company===co&&c.complete;});})){
  props.setProperty('PCC_INV_CURRENT_STATUS','PENDIENTE_PAQUETE_COMPLETO');return;
 }
 if(typeof cargarTrazabilidad!=='function'||typeof calcularEdadFIFO!=='function'||typeof buildResumen!=='function'||typeof buildBodegas!=='function'||typeof buildMovimientos!=='function')throw new Error('Faltan las funciones originales del inventario.');
 // The optional fifth argument keeps aging tied to the cut on deferred runs.
 if(calcularEdadFIFO.length<5)throw new Error('Falta habilitar fechaCorte en calcularEdadFIFO.');
 var folder=DriveApp.getFolderById(load.folderId),files={};
 ['invEU','invTEX','movEU','movTEX'].forEach(function(role){
  var f=pccHistNamed_(folder,role+'.json');if(!f)throw new Error('Falta el respaldo convertido '+role);
  files[role]=pccHistRead_(f);
  if(role.indexOf('mov')===0){
   var col=files[role][0].findIndex(function(h){return String(h).trim().toLowerCase()==='fecha';});
   if(col<0)throw new Error('Falta fecha en '+role);
   files[role].slice(1).forEach(function(r){if(/^\d{4}-\d{2}-\d{2}$/.test(String(r[col])))r[col]=new Date(r[col]+'T00:00:00-05:00');});
  }
 });
 var traz=cargarTrazabilidad(),edad=calcularEdadFIFO(files.movTEX,files.movEU,files.invTEX,files.invEU,batch.cutoff);
 var resumen=buildResumen(files.invTEX,files.invEU,edad,traz),bodegas=buildBodegas(edad,traz),mov=buildMovimientos(files.movTEX,files.movEU,traz);
 pccHistValueTables_(bodegas,resumen,batch.inventory);
 pccHistReconcileCurrent_(resumen,batch.inventory,'INV_Resumen');
 pccHistReconcileCurrent_(bodegas,batch.inventory,'INV_Bodegas');
 var tables=[{name:CFG.HOJA_RESUMEN,rows:resumen},{name:CFG.HOJA_BODEGAS,rows:bodegas},{name:CFG.HOJA_MOVIMIENTOS,rows:mov}];
 tables.forEach(function(t){pccHistCurrentDates_(t.rows,batch);});
 if(Date.now()+45000>deadline){props.setProperty('PCC_INV_CURRENT_STATUS','CONTINUAR_SIGUIENTE_EJECUCION');return;}
 var book=SpreadsheetApp.openById(CFG.OUTPUT_ID);
 var backupName='vistas-anteriores.json';
 if(!pccHistNamed_(folder,backupName))pccHistJson_(folder,backupName,tables.map(function(t){return {name:t.name,rows:book.getSheetByName(t.name).getDataRange().getValues()};}));
 var requests=pccHistCurrentRequests_(book,tables,batch.cutoff);
 var response=UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(CFG.OUTPUT_ID)+':batchUpdate',{
  method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},payload:JSON.stringify({requests:requests}),muteHttpExceptions:true
 });
 if(response.getResponseCode()!==200)throw new Error('No se publicaron las tablas de inventario (HTTP '+response.getResponseCode()+'): '+response.getContentText().slice(0,250));
 SpreadsheetApp.flush();
 pccHistReconcileCurrent_(book.getSheetByName(CFG.HOJA_BODEGAS).getDataRange().getValues(),batch.inventory,'INV_Bodegas publicada');
 pccHistReconcileCurrent_(book.getSheetByName(CFG.HOJA_RESUMEN).getDataRange().getValues(),batch.inventory,'INV_Resumen publicado');
 pccHistReconcileValue_(book.getSheetByName(CFG.HOJA_BODEGAS).getDataRange().getValues(),batch.inventory);
 pccHistReconcileValue_(book.getSheetByName(CFG.HOJA_RESUMEN).getDataRange().getValues(),batch.inventory);
 props.setProperty('PCC_INV_COST_VERSION','1');
 props.setProperty('PCC_INV_CURRENT_LOAD',load.id);
 props.setProperty('PCC_INV_CURRENT_STATUS','ACTUALIZADO · Corte '+batch.cutoff+' · '+batch.inventory.reduce(function(n,r){return n+r.units;},0)+' unidades');
 console.log('Inventario actual: '+props.getProperty('PCC_INV_CURRENT_STATUS'));
}
function pccHistTrySyncCurrent_(deadline){
 try{pccHistSyncCurrent_(deadline);}catch(e){
  PropertiesService.getScriptProperties().setProperty('PCC_INV_CURRENT_STATUS','REVISAR_INVENTARIO_ACTUAL · '+String(e.message||e).slice(0,400));
  console.error('Inventario actual: '+String(e.message||e));
 }
}
