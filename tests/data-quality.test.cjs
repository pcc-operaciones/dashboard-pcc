
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const data=require('../data-quality.js');
const root=require('node:path').join(__dirname,'..');
for(const file of ['index.html','inventario_pt.html'])test(file+' scripts compilables',()=>{
 const html=fs.readFileSync(root+'/'+file,'utf8');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=/.test(match[1]))new vm.Script(match[2]);
});
test('configuración JSON válida y período explícito',()=>{
 const config=JSON.parse(fs.readFileSync(root+'/config.json','utf8').replace(/^\uFEFF/,''));
 assert.equal(config.año,'2026');assert.ok(config.mes);
 for(const id of Object.values(config.ids))assert.match(id,/^[\w-]+$/);
});
test('período calendario incluye año bisiesto y meses faltantes',()=>{
 assert.deepEqual(data.period([{fecha:'2024-02-01'},{fecha:'2024-04-01'}],new Date('2024-06-10T12:00:00Z')),{days:90,label:'2024-02 a 2024-04',missing:['2024-03']});
 assert.equal(data.period([{fecha:'2025-12-01'},{fecha:'2026-01-01'}],new Date('2026-02-10T12:00:00Z')).days,62);
});
test('período actual se corta al día de consulta y no incluye futuro',()=>{
 assert.equal(data.period([{fecha:'2026-09-01'},{fecha:'2026-10-01'}],new Date('2026-09-14T12:00:00Z')).days,14);
 assert.equal(data.period([]).days,0);
});
test('rotación y cobertura definen ausencia de datos sin infinitos',()=>{
 assert.equal(data.rotation(100,200,365),2);assert.equal(data.coverage(100,200,100),50);
 assert.equal(data.rotation(0,200,365),null);assert.equal(data.rotation(100,0,365),0);
 assert.equal(data.rotation(100,200,0),null);assert.equal(data.coverage(100,0,365),null);
});
test('operaciones pondera magnitudes de distinto tamaño',()=>{
 const mods=[{pk:'TEX',daily:[{pro:90,um:100,real:50,teo:100,ing:100,cos:50}]},{pk:'EU',daily:[{pro:100,um:1000,real:900,teo:1000,ing:1000,cos:1000}]}];
 assert.equal(data.ops(mods,'ef'),950/1100);
 assert.equal(data.ops(mods,'cumpl'),190/1100);
 assert.equal(data.ops(mods,'util'),50/1100);
 assert.equal(data.ops([],'ef'),null);
});
test('servicios sin minutos no alteran eficiencia de confección',()=>{
 assert.equal(data.ops([{pk:'SERV',daily:[{real:200,teo:300,pro:10}]}],'ef'),null);
});
test('estado de fuente registra error y permite recuperación',async()=>{
 await assert.rejects(data.load('prueba',async()=>{throw Error('503');}));
 assert.equal(data.sources.get('prueba').state,'error');
 await data.load('prueba',async()=>[['cabecera'],[1]]);
 assert.equal(data.sources.get('prueba').state,'ok');
 data.sources.delete('prueba');
});
test('Cobros vacío muestra cero unidades en su render real',()=>{
 const html=fs.readFileSync(root+'/inventario_pt.html','utf8');
 const start=html.indexOf('function renderCobros(){');
 const end=html.indexOf('  destroyChart(',start);
 const elements={};
 const context={INV_DATA:[],glFilterReal:()=>true,fmt:String,fmtM:String,pct:()=>0,
 document:{getElementById:id=>(elements[id]??={})}};
 vm.runInNewContext(html.slice(start,end)+'}\nrenderCobros();',context);
 assert.equal(elements['cob-uds'].textContent,'0');
});
test('inventario no contiene fallback de muestra ni historia simulada',()=>{
 const html=fs.readFileSync(root+'/inventario_pt.html','utf8');
 assert.ok(!html.includes('cargarDatosPrueba'));
 assert.ok(!html.includes('obsActual*(0.7'));
});


test('selección excluye fuentes antiguas y elimina hojas duplicadas',()=>{
 const cfg={EU:{id:'actual',mods:{M1:'EF M1',M4:'EF M4'}},MODA:{id:'actual',mods:{M4:'EF M4'}},PREU2:{id:'antigua',mods:{M1:'EF M1'}}};
 const result=data.tasks(cfg,{ids:{EU:'actual',MODA:'actual'},modulosExtra:{'EU|M4':{sheet:'EF M4'}}});
 assert.deepEqual(result.items,[{pk:'EU',mk:'M1'},{pk:'EU',mk:'M4'}]);
 assert.equal(result.skipped.length,2);
});
test('fallo de la fuente principal oculta indicadores y permite reintentar',async()=>{
 const html=fs.readFileSync(root+'/inventario_pt.html','utf8');
 const fn=html.slice(html.indexOf('async function cargarTodo(){'),html.indexOf('function renderTodo(){'));
 const elements={};
 function element(){const classes=new Set();return {classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},remove(){},after(){},textContent:''};}
 const page=element(),notes=new Map();
 const context={inventarioCargando:false,RUTA_LINEA:{},DESC_MAP:{},STOCK_MIN_LINEA:new Map(),REFS_EU_LINEA:new Set(),
  INV_DATA:[{ref:'vieja'}],MOV_DATA:[{}],LINEA_EU_ID:'linea',INV_SHEET_ID:'inventario',
  fetchSheet:async(id)=>{if(id==='inventario')throw Error('HTTP 503');return [['REF']];},
  mapCols:()=>()=>-1,normStr:String,console:{log(){},warn(){}},setTimeout(){},
  PccData:{note:(k,v)=>notes.set(k,v)},document:{body:{dataset:{}},getElementById:id=>(elements[id]??=element()),querySelectorAll:()=>[page],querySelector:()=>element(),createElement:()=>element()}};
 await vm.runInNewContext(fn+'\ncargarTodo();',context);
 assert.equal(context.inventarioCargando,false);
 assert.equal(page.classList.contains('pcc-unavailable'),true);
 assert.equal(elements['inv-live-label'].textContent,'No disponible');
 assert.equal(context.INV_DATA.length,0);
 assert.match(notes.get('inventario'),/503/);
});

test('módulos sin metas no inflan el cumplimiento global',()=>{
 assert.equal(data.ops([{pk:'EU',daily:[{pro:80,um:100}]},{pk:'SERV',daily:[{pro:1000,um:0}]}],'cumpl'),0.8);
});
