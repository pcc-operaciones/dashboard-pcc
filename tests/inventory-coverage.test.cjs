const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../inventory-history-model.js');
const {runtime}=require('./helpers/inventory-runtime.cjs');
const row=(warehouse,units,ref='A')=>({company:'EU',ref,warehouse,units,description:'Prenda'});
const batch=(cutoff,stock,out,from='2026-06-19')=>({cutoff,inventory:[row('PT001',stock),row('PT002',1000)],coverage:['EU','TEX'].map(company=>({company,from,to:cutoff,complete:true})),movements:[{...row('PT001',0),date:cutoff,type:'RM',out},{...row('PT002',0),date:cutoff,type:'RM',out:9999},{...row('PT001',0),date:cutoff,type:'TR',out:7777}]});
const detail=b=>({cutoff:b.cutoff,rows:b.inventory,rotation:M.rotationSnapshot(b)});
test('período declarado usa 92 días e incluye extremos sin depender de la fecha de consulta',()=>{
 const t=[['MOVIMIENTOS_DESDE','MOVIMIENTOS_HASTA','FECHA_CORTE_DATOS'],['2026-06-19','2026-09-18','2026-09-18']];
 assert.equal(M.declaredPeriod(t).days,92);
 assert.equal(M.exactPeriod('2024-02-28','2024-03-01').days,3);
 assert.equal(M.exactPeriod('2026-09-18','2026-09-18').days,1);
 for(const t of [[],[['Mes'],[9]],[['MOVIMIENTOS_DESDE','MOVIMIENTOS_HASTA','FECHA_CORTE_DATOS'],['2026-06-19','2026-09-18','2026-09-18'],['2026-06-20','2026-09-18','2026-09-18']]])assert.equal(M.declaredPeriod(t).days,0);
 for(const [f,t,c]of [['2026-02-30','2026-03-01','2026-03-01'],['2026-09-19','2026-09-18','2026-09-18'],['2026-09-01','2026-09-19','2026-09-18']])assert.equal(M.exactPeriod(f,t,c).days,0);
});
test('cobertura conserva existencias y RM del propio corte; excluye segundas, cobros y traslados',()=>{
 const a=detail(batch('2026-09-18',920,1840));
 assert.equal(M.coverageAtCut(a).days,46);
 assert.equal(M.coverageAtCut(a).stock,920);assert.equal(M.coverageAtCut(a).dispatch,1840);
 const b=detail(batch('2026-10-18',1220,1220));
 assert.equal(M.coverageAtCut(b).days,122);
 assert.equal(M.coverageAtCut(a).days,46);
 for(const w of ['PT002','PT003','TI005','TI006'])assert.equal(M.isFirst(w),false);
 assert.equal(M.coverageAtCut(a,r=>r.warehouse==='TI004').days,null);
 assert.equal(M.coverageAtCut({cutoff:a.cutoff,rows:a.rows}),null);
 assert.equal(M.coverageAtCut(detail(batch('2026-09-18',920,0))).days,null);
});
test('mensual elige el último corte disponible y no inventa meses o cierres',()=>{
 const cuts=['2026-09-17','2026-09-18','2026-10-15','2026-10-25'].map(cutoff=>({cutoff}));
 assert.deepEqual(M.monthlyCuts(cuts,'2026-10-20').map(c=>c.cutoff),['2026-09-18','2026-10-15']);
});
test('no calcula cobertura con períodos incompletos o distintos entre empresas',()=>{
 const b=batch('2026-09-18',920,1840);b.coverage[1].complete=false;assert.equal(M.rotationSnapshot(b),null);
 b.coverage[1].complete=true;b.coverage[1].from='2026-06-20';assert.equal(M.rotationSnapshot(b),null);
});
test('migración republica cortes existentes sin nueva carga y mantiene el archivo original',()=>{
 const r=runtime();r.enablePublication();r.declare();r.ctx.procesarHistoricoPT();
 const state=r.props.get('PCC_HIST_STATE_FILE'),qfile=r.objects.get(r.props.get('PCC_HIST_QUERY_FILE'));
 const q=JSON.parse(qfile.bytes.toString());q.publicationVersion=1;qfile.bytes=Buffer.from(JSON.stringify(q));
 r.props.set('PCC_HIST_PUBLICATION_VERSION','1');
 const control=r.book.getSheetByName('INV_Hist_Control'),old=control.getRange(1,1).getValue();
 r.ctx.procesarHistoricoPT();
 assert.equal(r.props.get('PCC_HIST_STATE_FILE'),state);assert.equal(r.state().loads.length,1);
 assert.notEqual(control.getRange(1,1).getValue(),old);assert.equal(r.props.get('PCC_HIST_PUBLICATION_VERSION'),'3');
 const index=JSON.parse(control.getRange(1,1).getValue()),s=r.book.getSheetByName('INV_Hist_Datos');
 const read=d=>JSON.parse(s.getRange(d.row,1,d.count,1).getValues().map(r=>r[0].slice(1)).join(''));
 const result=read(index),d=read(result.cuts[0].detail);assert.equal(d.rotation.period.days,16);assert.equal(d.rows.length,2);
});

test('gráfica mensual usa existencias del corte y descarta una respuesta de filtros anterior',async()=>{
 const fs=require('fs'),vm=require('vm'),html=fs.readFileSync('inventario_pt.html','utf8');
 const code=html.slice(html.indexOf('async function loadCoverageChart('),html.indexOf('// ─── RESUMEN ───'));
 const note={},chart={data:{datasets:[{}]},options:{scales:{y:{}},plugins:{datalabels:{},tooltip:{callbacks:{}}}},updates:0,update(){this.updates++;}};
 const d=detail(batch('2026-09-18',920,1840));let release;
 const ctx={document:{getElementById:()=>note},INV_DATA:[{empresa:'EU',ref:'A',lineaReal:'EU Línea',cutoff:'2026-09-18',totalUds:999999}],MOV_DATA:[],REF_MAP:{},DESC_MAP:{},clasificarRef:()=> 'EU Línea',glFilter:()=>true,fmt:String,PccHistoryModel:M,coverageChartRequest:1};
 ctx.window=ctx;ctx._ch2=chart;ctx.PccInventoryHistoryView={coverageSeries:()=>new Promise(r=>release=r)};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const first=ctx.loadCoverageChart(1,[{key:'2026-08'},{key:'2026-09'}]);ctx.coverageChartRequest=2;release([d]);await first;assert.equal(chart.updates,0);
 ctx.PccInventoryHistoryView.coverageSeries=async()=>[d];await ctx.loadCoverageChart(2,[{key:'2026-08'},{key:'2026-09'}]);
 assert.deepEqual(Array.from(chart.data.datasets[0].data),[null,46]);assert.equal(chart.updates,1);
 assert.match(chart.options.plugins.tooltip.callbacks.afterLabel({datasetIndex:0,dataIndex:1})[0],/18\/09\/2026/);
});
