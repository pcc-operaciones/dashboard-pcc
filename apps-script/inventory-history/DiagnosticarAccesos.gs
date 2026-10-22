/** Verifica permisos sin mostrar IDs ni modificar archivos. Ejecutar manualmente. */
function diagnosticarAccesosHistoricoPT(){
 var c=pccHistConfig_();
 var checks=[
  ['Carpeta histórica',function(){DriveApp.getFolderById(c.archiveFolderId).getName();}],
  ['Inventario EU',function(){DriveApp.getFileById(c.files.invEU).getBlob().getBytes().length;}],
  ['Inventario TEX',function(){DriveApp.getFileById(c.files.invTEX).getBlob().getBytes().length;}],
  ['Movimientos EU',function(){DriveApp.getFileById(c.files.movEU).getBlob().getBytes().length;}],
  ['Movimientos TEX',function(){DriveApp.getFileById(c.files.movTEX).getBlob().getBytes().length;}],
  ['Costos Unificados',function(){SpreadsheetApp.openById('1_Bayb-gfBHizgidaaIYoKA_bh96eNDtJwN5Nqa1TCWM').getSheetByName('Costos Unificados').getLastRow();}]
 ];
 checks.forEach(function(item){
  try{item[1]();Logger.log(item[0]+': OK');}
  catch(e){Logger.log(item[0]+': SIN ACCESO ('+String(e.message||e).slice(0,120)+')');}
 });
}
