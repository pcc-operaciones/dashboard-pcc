/* Save the retail tier alongside a newly accepted inventory cut.
 * Older cuts intentionally have no retail tier unless captured at acceptance.
 */
function pccHistRetailSnapshot_(load,batch){
 if(!batch.inventoryComplete)return null;
 var folder=DriveApp.getFolderById(load.folderId),name='precio-publico-v1.json',existing=pccHistNamed_(folder,name);
 if(existing){
  var cached=pccHistRead_(existing);
  if(cached.version!==1||cached.loadId!==load.id||cached.cutoff!==batch.cutoff)throw new Error('El precio público guardado no corresponde a este corte.');
  return cached;
 }
 var book=SpreadsheetApp.openById('1_Bayb-gfBHizgidaaIYoKA_bh96eNDtJwN5Nqa1TCWM'),sheet=book.getSheetByName('Costos Unificados');
 if(!sheet)throw new Error('No se encontró Costos Unificados para el precio público.');
 var headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(function(x){return String(x||'').trim().toUpperCase();});
 var indices=['EMPRESA','FECHA COSTEO','REFERENCIA.','VTA ALMACEN FINAL'].map(function(h){var i=headers.indexOf(h);if(i<0)throw new Error('Falta '+h+' en Costos Unificados.');return i+1;});
 var count=sheet.getLastRow()-1,columns=indices.map(function(i){return count>0?sheet.getRange(2,i,count,1).getValues():[];});
 var records=[];for(var i=0;i<count;i++)records.push({company:columns[0][i][0],costedAt:columns[1][i][0],ref:columns[2][i][0],price:columns[3][i][0]});
 var catalog=PccRetailPrice.select(records,batch.cutoff),wanted={};
 batch.inventory.forEach(function(r){wanted[PccRetailPrice.key(r.company,r.ref)]=true;});
 var rows=[];Object.keys(wanted).forEach(function(key){
  var p=catalog.get(key);if(!p||p.conflict||p.price===null)return;
  var parts=key.split('|');rows.push({company:parts[0],ref:parts.slice(1).join('|'),price:p.price,costedAt:p.costedAt});
 });
 var result={version:1,loadId:load.id,cutoff:batch.cutoff,capturedAt:new Date().toISOString(),rows:rows};
 var saved=pccHistJson_(folder,name,result),check=pccHistRead_(saved);
 if(check.loadId!==load.id||check.cutoff!==batch.cutoff||check.rows.length!==rows.length)throw new Error('No se verificó el precio público archivado.');
 return result;
}
function pccHistRetailSaved_(load,batch){
 var file=pccHistNamed_(DriveApp.getFolderById(load.folderId),'precio-publico-v1.json');
 if(!file)return null;
 var data=pccHistRead_(file);
 if(data.version!==1||data.loadId!==load.id||data.cutoff!==batch.cutoff)throw new Error('Precio público del corte no válido.');
 return data;
}
