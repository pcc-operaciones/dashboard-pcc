/* Derived once from each immutable batch; never use today's stock, cost or clock. */
function pccHistMonthlyMetrics_(load,batch){
 var folder=DriveApp.getFolderById(load.folderId),name='metricas-mensuales-v1.json';
 var cached=pccHistNamed_(folder,name);
 if(cached){var value=pccHistRead_(cached);if(value.cutoff!==batch.cutoff||value.loadId!==load.id)throw Error('Métricas del corte no coinciden.');return value;}
 var result={version:1,loadId:load.id,cutoff:batch.cutoff,dispatch:PccHistoryModel.dispatchSnapshot(batch),aging:null};
 // Standalone archives can publish dispatches before installing the legacy processor.
 if(typeof calcularEdadFIFO!=='function'||!['EU','TEX'].every(function(co){return batch.coverage.some(function(c){return c.company===co&&c.complete&&c.to===batch.cutoff;});}))return result;
 if(calcularEdadFIFO.length<5)throw Error('La antigüedad histórica requiere fechaCorte en calcularEdadFIFO.');
 var files={};
 ['invEU','invTEX','movEU','movTEX'].forEach(function(role){
  var f=pccHistNamed_(folder,role+'.json');if(!f)throw Error('Falta respaldo '+role+' para el corte '+batch.cutoff);
  files[role]=pccHistRead_(f);
  if(role.indexOf('mov')===0){
   var col=files[role][0].findIndex(function(h){return String(h).trim().toLowerCase()==='fecha';});
   if(col<0)throw Error('Falta fecha en '+role);
   files[role].slice(1).forEach(function(r){if(/^\d{4}-\d{2}-\d{2}$/.test(String(r[col])))r[col]=new Date(r[col]+'T00:00:00-05:00');});
  }
 });
 // Taxonomy does not affect aging or valuation; avoid consulting mutable traceability.
 var traz={eu:{},tex:{}},edad=calcularEdadFIFO(files.movTEX,files.movEU,files.invTEX,files.invEU,batch.cutoff);
 var resumen=buildResumen(files.invTEX,files.invEU,edad,traz),bodegas=buildBodegas(edad,traz);
 pccHistValueTables_(bodegas,resumen,batch.inventory);
 pccHistReconcileCurrent_(resumen,batch.inventory,'Antigüedad histórica');
 pccHistReconcileCurrent_(bodegas,batch.inventory,'Antigüedad por SKU');
 var h=resumen[0],get=function(row,key){var i=h.indexOf(key);if(i<0)throw Error('Falta columna histórica '+key);return row[i];};
 result.aging=resumen.slice(1).map(function(r){return {company:get(r,'Empresa'),ref:get(r,'Referencia'),warehouse:get(r,'Bodega'),description:get(r,'Descripcion'),knownValue:get(r,'Valor_Conocido'),riskValue:get(r,'Costo_90mas'),missingCostUnits:get(r,'Uds_Sin_Costo')};});
 var saved=pccHistJson_(folder,name,result),verified=pccHistRead_(saved);
 if(JSON.stringify(result)!==JSON.stringify(verified))throw Error('Métricas históricas no verificadas.');
 return verified;
}
