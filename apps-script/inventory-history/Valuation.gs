/* Valuation is derived only from the inventory archived with this load.
 * Original Excel and canonical batches remain immutable. Never use live prices
 * or movement amounts to revalue a past cut.
 */
function pccHistValuedBatch_(load,batch){
 if(batch.valuationVersion===1)return batch;
 var folder=DriveApp.getFolderById(load.folderId),name='valoracion-v1.json',saved=pccHistNamed_(folder,name),derived;
 if(saved)derived=pccHistRead_(saved);
 else{
  var inventory=[];
  ['EU','TEX'].forEach(function(company){
   var file=pccHistNamed_(folder,'inv'+company+'.json');
   if(!file)throw new Error('Falta inventario archivado para valorar '+company);
   inventory=inventory.concat(PccInventoryHistory.inventory(pccHistRead_(file),company,batch.cutoff).records);
  });
  derived={version:1,loadId:load.id,cutoff:batch.cutoff,inventory:inventory};
 }
 if(derived.version!==1||derived.loadId!==load.id||derived.cutoff!==batch.cutoff)throw new Error('Valoración de otro corte o carga.');
 var key=function(r){return JSON.stringify([r.company,r.ref,r.size,r.color,r.warehouse]);},old={};
 batch.inventory.forEach(function(r){old[key(r)]=r;});
 if(derived.inventory.length!==batch.inventory.length)throw new Error('La valoración cambia la cantidad de registros.');
 derived.inventory.forEach(function(r){var o=old[key(r)];if(!o||['units','committed','available'].some(function(k){return o[k]!==r[k];}))throw new Error('La valoración no concilia con el corte original.');delete old[key(r)];});
 if(Object.keys(old).length)throw new Error('La valoración omite registros.');
 if(!saved){saved=pccHistJson_(folder,name,derived);if(JSON.stringify(pccHistRead_(saved))!==JSON.stringify(derived))throw new Error('No se verificó la valoración archivada.');}
 return Object.assign({},batch,{valuationVersion:1,inventory:derived.inventory,totals:PccInventoryHistory.totals(derived.inventory)});
}
function pccHistValueTables_(bodegas,resumen,inventory){
 var key=function(r){return JSON.stringify([r.company,String(r.ref).toUpperCase(),r.size,r.color,r.warehouse]);};
 var bySku={},groups={};inventory.forEach(function(r){bySku[key(r)]=r;});
 var extra=['Costo_Unitario','Origen_Costo','Uds_Sin_Costo','Valor_Conocido','Valoracion_Version','Precio_Unitario_ERP','Costo_Prom_Unit_ERP'];
 var uh=['Uds_0_30','Uds_30_60','Uds_60_90','Uds_90mas'],ch=['Costo_0_30','Costo_30_60','Costo_60_90','Costo_90mas'];
 function set(row,h,name,v){var i=h.indexOf(name);if(i<0)throw new Error('Falta columna '+name);row[i]=v;}
 function valueRow(row,h,records){
  var v=PccHistoryModel.valuationTotals(records),units=records.reduce(function(n,r){return n+r.units;},0);
  set(row,h,'Valor_Costo',v.value);
  row.push(v.missingCostUnits||!units?null:v.knownValue/units,v.costSources.join(' + ')||'SIN_COSTO',v.missingCostUnits,v.knownValue,1,
   records.length===1?records[0].erpPrice:null,records.length===1?records[0].erpAverageCost:null);
 }
 var bh=bodegas[0].slice();
 bodegas.slice(1).forEach(function(row){
  var r=bySku[key({company:row[bh.indexOf('Empresa')],ref:row[bh.indexOf('Referencia')],size:String(row[bh.indexOf('Talla')]),color:String(row[bh.indexOf('Color_Cod')]),warehouse:row[bh.indexOf('Bodega')]})];
  if(!r||Math.abs(Number(row[bh.indexOf('Total_Uds')])-r.units)>0.000001)throw new Error('SKU de valoración no coincide con INV_Bodegas.');
  valueRow(row,bh,[r]);
  var gk=JSON.stringify([r.company,String(r.ref).toUpperCase(),r.warehouse]);
  if(!groups[gk])groups[gk]={records:[],units:[0,0,0,0],costs:[0,0,0,0]};
  var g=groups[gk];g.records.push(r);
  var used=0,allocatedUnits=0;
  uh.forEach(function(k,i){var units=Number(row[bh.indexOf(k)]);g.units[i]+=units;
   allocatedUnits+=units;var cumulative=r.value===null?0:Math.round(allocatedUnits*r.unitCost*100)/100;var cost=cumulative-used;used=cumulative;g.costs[i]+=cost;
  });
 });
 bodegas[0]=bh.concat(extra);
 var rh=resumen[0].slice();
 resumen.slice(1).forEach(function(row){
  var g=groups[JSON.stringify([row[rh.indexOf('Empresa')],String(row[rh.indexOf('Referencia')]).toUpperCase(),row[rh.indexOf('Bodega')]])];
  if(!g){if(Number(row[rh.indexOf('Total_Uds')])!==0)throw new Error('Falta grupo de valoración.');g={records:[],units:[0,0,0,0],costs:[0,0,0,0]};}
  valueRow(row,rh,g.records);
  uh.forEach(function(k,i){set(row,rh,k,g.units[i]);set(row,rh,ch[i],Math.round(g.costs[i]*100)/100);});
  set(row,rh,'Idx_Riesgo',g.units[1]+2*g.units[2]+4*g.units[3]);
  var total=Number(row[rh.indexOf('Total_Uds')]);set(row,rh,'Pct_En_Riesgo',total>0?Math.round(g.units[3]/total*100):0);
 });
 resumen[0]=rh.concat(extra);
 pccHistReconcileValue_(bodegas,inventory);pccHistReconcileValue_(resumen,inventory);
}
function pccHistReconcileValue_(table,inventory){
 var h=table[0],actual={};['Empresa','Referencia','Bodega','Valor_Costo','Valor_Conocido','Uds_Sin_Costo','Valoracion_Version'].forEach(function(k){if(h.indexOf(k)<0)throw new Error('Falta control de valoración: '+k);});
 table.slice(1).forEach(function(r){
  var k=JSON.stringify([r[h.indexOf('Empresa')],String(r[h.indexOf('Referencia')]).toUpperCase(),r[h.indexOf('Bodega')]]);
  if(!actual[k])actual[k]={value:0,missing:0};
  var v=r[h.indexOf('Valor_Conocido')],m=r[h.indexOf('Uds_Sin_Costo')];
  if(typeof v!=='number'||!Number.isFinite(v)||typeof m!=='number'||!Number.isFinite(m)||r[h.indexOf('Valoracion_Version')]!==1)throw new Error('Control de valoración inválido.');
  var total=r[h.indexOf('Valor_Costo')];
  if(m?(total!==null&&total!==''):typeof total!=='number'||Math.abs(total-v)>0.011)throw new Error('Valor completo no concilia.');
  actual[k].value+=v;actual[k].missing+=m;
 });
 PccHistoryModel.groupStock(inventory).forEach(function(r){var k=JSON.stringify([r.company,String(r.ref).toUpperCase(),r.warehouse]),a=actual[k]||{value:0,missing:0};
  if(Math.abs(a.value-r.knownValue)>0.011||Math.abs(a.missing-r.missingCostUnits)>0.000001)throw new Error('El costo no concilia en '+k);
  delete actual[k];
 });
 if(Object.keys(actual).some(function(k){return actual[k].value||actual[k].missing;}))throw new Error('Valoración con grupos adicionales.');
}
