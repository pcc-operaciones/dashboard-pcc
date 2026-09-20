const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const H=require('../scripts/inventory-history/core.js'),M=require('../inventory-history-model.js');
const header=['Referencia','Desc. item','Detalle ext. 2','Detalle ext. 1','Bodega','Existencia','Cant. comprometida','Cant. disponible','Precio unitario','Costo prom. unit. (ins)'];
const row=(price=30,cost=20,units=3)=>['001','Prenda','M','01','PT001',units,0,units,price,cost];
const parse=(r,head=header)=>H.inventory([head,...r],'EU','2026-09-20').records;
test('valuation: price priority, fallback, blank/zero missing and preserved raw origins',()=>{
 for(const [p,c,u,source]of [[30,20,30,'PRECIO_UNITARIO'],[0,20,20,'COSTO_PROMEDIO'],['',20,20,'COSTO_PROMEDIO'],[0,0,null,'SIN_COSTO'],['','',null,'SIN_COSTO']]){
  const r=parse([row(p,c)])[0];assert.equal(r.unitCost,u);assert.equal(r.costSource,source);assert.equal(r.value,u===null?null:3*u);assert.equal(r.erpPrice,p===''?null:p);
 }
});
test('valuation: duplicate headers, negative and ambiguous costs fail rather than hide',()=>{
 for(const r of [row(-1,20),row(30,-1),row('1.000,50',20),row(Infinity,20)])assert.throws(()=>parse([r]));
 assert.throws(()=>parse([row()],header.concat('Precio unitario')),/repetida/);
});
test('valuation: old cut without costs stays unknown and zero stock is not missing stock',()=>{
 const r=parse([row().slice(0,8)],header.slice(0,8))[0];assert.equal(r.value,null);
 assert.equal(M.stockTotals(M.groupStock([r])).value,null);
 const z=parse([row(0,0,0)])[0];assert.equal(M.stockTotals(M.groupStock([z])).missingCostUnits,0);
});
test('valuation: mixed SKU origins aggregate amounts, not arithmetic average costs',()=>{
 const a=parse([row(30,20,3)])[0],b={...parse([row(0,20,1)])[0],size:'L'};
 let g=M.groupStock([a,b])[0];assert.equal(g.unitCost,27.5);assert.equal(g.value,110);assert.deepEqual(g.costSources,['COSTO_PROMEDIO','PRECIO_UNITARIO']);
 const c={...parse([row(0,0,2)])[0],size:'S'};g=M.groupStock([a,b,c])[0];assert.equal(g.value,null);assert.equal(g.unitCost,null);assert.equal(g.knownValue,110);assert.equal(g.missingCostUnits,2);
 assert.equal(M.stockTotals([g]).knownValue,110);assert.equal(M.stockTotals([g]).value,null);
});
const valuation=fs.readFileSync('apps-script/inventory-history/Valuation.gs','utf8');
function ctx(extra={}){const c=vm.createContext({PccInventoryHistory:H,PccHistoryModel:M,...extra});vm.runInContext(valuation,c);return c;}
const bh=['Empresa','Referencia','Descripcion','Linea','Temporada','Talla','Color_Cod','Color_Desc','Bodega','Desc_Bodega','Tipo_Bodega','Uds_0_30','Uds_30_60','Uds_60_90','Uds_90mas','Total_Uds','Valor_Costo','Fecha_Actualizacion'];
const rh=['Empresa','Referencia','Bodega','Total_Uds','Valor_Costo','Uds_0_30','Costo_0_30','Uds_30_60','Costo_30_60','Uds_60_90','Costo_60_90','Uds_90mas','Costo_90mas','Idx_Riesgo','Pct_En_Riesgo'];
function tables(){return {b:[bh.slice(),['EU','001','Prenda','','','M','01','','PT001','','',1,0,0,2,3,999999,'old']],r:[rh.slice(),['EU','001','PT001',3,999999,300,9999,0,0,0,0,200,9999,999,99]]};}
test('valuation: replaces inflated movement money and warehouse-wide age duplication atomically',()=>{
 const c=ctx(),{b,r}=tables(),inv=parse([row(30,20)]);c.pccHistValueTables_(b,r,inv);
 assert.equal(b[1][b[0].indexOf('Valor_Costo')],90);assert.equal(r[1][r[0].indexOf('Valor_Costo')],90);
 assert.equal(r[1][r[0].indexOf('Costo_90mas')],60);assert.equal(r[1][r[0].indexOf('Uds_90mas')],2);
 assert.equal(b[1][b[0].indexOf('Precio_Unitario_ERP')],30);
 b[1][b[0].indexOf('Valor_Conocido')]++;assert.throws(()=>c.pccHistReconcileValue_(b,inv),/concilia/);
});
test('valuation: absent cost publishes blank full value, explicit missing units, no phantom money',()=>{
 const c=ctx(),{b,r}=tables(),inv=parse([row(0,0)]);c.pccHistValueTables_(b,r,inv);
 assert.equal(b[1][16],null);assert.equal(b[1][b[0].indexOf('Uds_Sin_Costo')],3);assert.equal(r[1][r[0].indexOf('Costo_90mas')],0);
});
test('valuation: migration uses this load archived inventory and keeps the canonical batch untouched',()=>{
 const old=parse([row(0,0).slice(0,8)],header.slice(0,8)),batch={cutoff:'2026-09-20',inventory:old};delete old[0].valuationVersion;
 const files={'invEU.json':[header,row(40,20)],'invTEX.json':[header]};let writes=0;
 const c=ctx({DriveApp:{getFolderById:()=> 'archive'},pccHistNamed_:(f,n)=>files[n]?n:null,pccHistRead_:n=>files[n],pccHistJson_:(f,n,v)=>{writes++;files[n]=structuredClone(v);return n;}});
 const load={id:'a',folderId:'folder'},first=c.pccHistValuedBatch_(load,batch);assert.equal(first.inventory[0].unitCost,40);assert.equal(batch.inventory[0].value,null);
 files['invEU.json'][1][8]=900;assert.equal(c.pccHistValuedBatch_(load,batch).inventory[0].unitCost,40);assert.equal(writes,1);
 assert.throws(()=>c.pccHistValuedBatch_({...load,id:'other'},batch),/otro corte/);
});
test('valuation: migration cannot alter quantities or relabel the cut',()=>{
 const batch={cutoff:'2026-09-20',inventory:parse([row()])};
 const c=ctx({DriveApp:{getFolderById:()=>''},pccHistNamed_:()=> 'cache',pccHistRead_:()=>({version:1,loadId:'a',cutoff:batch.cutoff,inventory:parse([row(30,20,4)])})});
 assert.throws(()=>c.pccHistValuedBatch_({id:'a'},batch),/no concilia/);
});

test('valuation: cumulative cent allocation preserves total and never gives cost to an empty age band',()=>{
 const c=ctx(),{b,r}=tables(),inv=parse([row(0.335,0,3)]);b[1][11]=1;b[1][12]=1;b[1][13]=1;b[1][14]=0;c.pccHistValueTables_(b,r,inv);
 const h=r[0],costs=['Costo_0_30','Costo_30_60','Costo_60_90','Costo_90mas'].map(k=>r[1][h.indexOf(k)]);
 assert.equal(costs[3],0);assert.ok(Math.abs(costs.reduce((n,v)=>n+v,0)-1.01)<1e-9);assert.ok(costs.every(v=>v>=0));
});

test('valuation: old publication migrates from its own archived inventory, preserving old unknown costs',()=>{
 const {runtime}=require('./helpers/inventory-runtime.cjs'),r=runtime();r.enablePublication();r.declare();r.ctx.procesarHistoricoPT();
 const l=r.state().loads[0],file=r.objects.get(l.dataId),batch=JSON.parse(file.bytes.toString());delete batch.valuationVersion;
 batch.inventory.forEach(x=>{delete x.valuationVersion;delete x.unitCost;delete x.erpPrice;delete x.erpAverageCost;delete x.costSource;});file.bytes=Buffer.from(JSON.stringify(batch));
 r.props.set('PCC_HIST_PUBLICATION_VERSION','2');const qf=r.objects.get(r.props.get('PCC_HIST_QUERY_FILE')),q=JSON.parse(qf.bytes.toString());q.publicationVersion=2;qf.bytes=Buffer.from(JSON.stringify(q));
 r.ctx.procesarHistoricoPT();assert.equal(r.props.get('PCC_HIST_PUBLICATION_VERSION'),'3');
 const updated=JSON.parse(r.objects.get(r.props.get('PCC_HIST_QUERY_FILE')).bytes.toString());assert.equal(updated.cuts[0].summary[0].value,null);assert.equal(updated.cuts[0].summary[0].missingCostUnits,10);
 assert.equal(JSON.parse(file.bytes.toString()).valuationVersion,undefined);
});

test('valuation UI: stock reads raw numbers so Sheets currency formatting cannot round the costs',async()=>{
 const html=fs.readFileSync('inventario_pt.html','utf8'),code=html.slice(html.indexOf('async function fetchSheet('),html.indexOf('function normStr('));let seen;
 const c=vm.createContext({BASE:'https://example.test',API_KEY:'test',Date,AbortSignal,PccData:{load:(_,fn)=>fn()},fetch:async url=>{seen=new URL(url);return {ok:true,json:async()=>({values:[[1234.56]]})};}});vm.runInContext(code,c);
 const data=await c.fetchSheet('test-sheet','INV_Bodegas');assert.equal(seen.searchParams.get('valueRenderOption'),'UNFORMATTED_VALUE');assert.equal(data[0][0],1234.56);
 await c.fetchSheet('test-sheet','EU_Lotes');assert.equal(seen.searchParams.has('valueRenderOption'),false);
});
