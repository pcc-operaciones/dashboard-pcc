/* Acceso explícito a los datos ya cargados. No consulta fuentes adicionales. */
(function(){
  window.PccExecutiveSource=()=>{
    let inventory={status:'loading',records:[]};
    try{inventory=document.getElementById('iframe-inventario')?.contentWindow?.PccExecutiveInventory?.()||inventory;}catch{inventory={status:'error',records:[]};}
    const records=[...PccFresh.records.values()];
    return {config:window._pccConfig,ops:{status:window._executiveOpsStatus||'loading',mods:allM(),records:records.filter(r=>r.group==='ops')},cos:{status:window._executiveCostStatus||'loading',rows:COSTOS_DATA,records:records.filter(r=>r.group==='cos')},inv:inventory};
  };
  window.PccExecutiveOpen=function(area){
    if(area==='cos'){
      const key=PccExecutiveModel.period(window._pccConfig);
      if(key){
        _msAniosSel=[key.slice(0,4)];_msPeriodosSel=[key];_msLineasSel=[];_msCatsSel=[];
        _poblarMesesDisponibles();
        document.querySelectorAll('#msAnio input').forEach(i=>i.checked=i.value===key.slice(0,4));
        document.querySelectorAll('#msPerItems input').forEach(i=>i.checked=i.value===key);
        document.querySelectorAll('#msLinea input,#msCat input').forEach(i=>i.checked=false);
        g('lblAnio').textContent=key.slice(0,4);g('lblPer').textContent=window._pccConfig.mes+' '+window._pccConfig.año;
        g('lblLinea').textContent='Todas';g('lblCat').textContent='Todas';
        if(g('chCostRef'))g('chCostRef').value='';
        showCostosTab('resumen',g('cTab-resumen'));aplicarFiltrosCostos();
      }
    }
    if(area==='inv'){try{g('iframe-inventario').contentWindow.glClear();}catch{}}
    switchGerencia(area);
    if(area==='ops')showPage('area',document.querySelector('.nav-btn'));
  };
})();
