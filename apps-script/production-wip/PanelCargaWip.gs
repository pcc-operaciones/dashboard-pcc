/* Panel de carga dentro de KPI PCC MENSUAL.
 * Pegar como un archivo .gs adicional en el proyecto vinculado SyncExcel.
 * No crea activadores ni modifica las funciones originales.
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Carga WIP')
    .addItem('Abrir panel de carga', 'abrirPanelCargaWip')
    .addToUi();
}

function abrirPanelCargaWip() {
  var html = HtmlService.createHtmlOutput(`<!doctype html>
<html><head><base target="_top"><style>
  body{font:13px Arial,sans-serif;color:#17324f;margin:0;padding:18px;line-height:1.4}
  h2{font-size:17px;margin:0 0 8px}p{color:#53677d;margin:0 0 16px}
  label{display:block;font-weight:700;margin-bottom:5px}input{box-sizing:border-box;width:100%;padding:9px;border:1px solid #b8c9d9;border-radius:6px;font:inherit}
  button{width:100%;padding:10px;margin-top:12px;border:0;border-radius:6px;background:#116d61;color:white;font:700 13px Arial,sans-serif;cursor:pointer}
  button.secondary{background:#e7edf3;color:#17324f;margin-top:7px}button:disabled{opacity:.55;cursor:wait}
  #estado{white-space:pre-wrap;border:1px solid #d8e2ec;border-radius:6px;padding:10px;margin-top:16px;min-height:48px;background:#f7fafc}
  #estado.ok{border-color:#a7d7bd;background:#eef9f1}#estado.error{border-color:#efb4b4;background:#fff4f4}
  small{display:block;color:#60758a;margin-top:10px}
</style></head><body>
  <h2>Carga de Producción y WIP</h2>
  <p>Reemplaza primero los cuatro Excel de lotes y costos EU/TEX en Drive. Todos deben corresponder al mismo corte.</p>
  <label for="corte">Fecha real del corte de los cuatro Excel</label>
  <input id="corte" type="date" required>
  <button id="procesar" type="button">Procesar los cuatro Excel</button>
  <button id="consultar" class="secondary" type="button">Consultar estado</button>
  <small>El proceso copia los lotes y luego calcula las alertas y costos. Mantén abierto este panel hasta ver el resultado.</small>
  <div id="estado" role="status" aria-live="polite">Esperando tu fecha de corte.</div>
<script>
  var el=function(id){return document.getElementById(id)};
  function mostrar(message,kind){el('estado').textContent=message;el('estado').className=kind||''}
  function ejecutar(name,args){return new Promise(function(resolve,reject){
    var call=google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
    if(name==='guardarFechaPanelWip')call.guardarFechaPanelWip(args[0]);
    else if(name==='sincronizarDatos')call.sincronizarDatos();
    else if(name==='calcularKPIs')call.calcularKPIs();
    else if(name==='estadoPanelWip')call.estadoPanelWip();
    else reject(new Error('Acción desconocida'));
  })}
  function ocupado(value){el('procesar').disabled=value;el('consultar').disabled=value;el('corte').disabled=value}
  async function consultar(){
    try{var x=await ejecutar('estadoPanelWip');mostrar('Fecha declarada: '+(x.cutoff||'pendiente')+'\\nEstado: '+x.status+'\\nOP publicadas: '+x.rows,(x.status||'').indexOf('PUBLICADO')===0?'ok':'')}
    catch(e){mostrar((e&&e.message)||String(e),'error')}
  }
  async function procesar(){
    var cutoff=el('corte').value;
    if(!cutoff){mostrar('Selecciona la fecha real del corte.','error');return}
    ocupado(true);
    try{
      mostrar('Guardando la fecha del corte…');
      await ejecutar('guardarFechaPanelWip',[cutoff]);
      mostrar('Paso 1 de 2: copiando los Excel de lotes y calidad…');
      await ejecutar('sincronizarDatos');
      mostrar('Paso 2 de 2: calculando alertas y costos WIP…');
      await ejecutar('calcularKPIs');
      var x=await ejecutar('estadoPanelWip');
      if((x.status||'').indexOf('PUBLICADO')===0){mostrar(x.status+'\\nOP publicadas: '+x.rows,'ok')}
      else{mostrar(x.status+'\\nRevisa el estado antes de cerrar el panel.','error')}
    }catch(e){mostrar('No se completó la carga: '+((e&&e.message)||String(e))+'\\nLa carga anterior permanece disponible.','error')}
    finally{ocupado(false)}
  }
  el('procesar').addEventListener('click',procesar);
  el('consultar').addEventListener('click',consultar);
  consultar();
</script></body></html>`);
  html.setTitle('Carga de Producción y WIP').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function guardarFechaPanelWip(value) {
  var cutoff = pccWipFecha_(value);
  var today = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  if (cutoff > today) throw new Error('La fecha de corte no puede ser futura.');
  var ss = SpreadsheetApp.openById(KPI_SPREADSHEET_ID);
  var control = pccWipEstado_(ss, 'FECHA REGISTRADA · pendiente de procesar los cuatro Excel');
  control.getRange('B2').setNumberFormat('@').setValue(cutoff);
  return cutoff;
}

function estadoPanelWip() {
  var ss = SpreadsheetApp.openById(KPI_SPREADSHEET_ID);
  var control = ss.getSheetByName(PCC_WIP_CONTROL);
  var costs = ss.getSheetByName(PCC_WIP_HOJA);
  return {
    cutoff: control ? String(control.getRange('B2').getDisplayValue() || '') : '',
    status: control ? String(control.getRange('B3').getDisplayValue() || 'Sin procesar') : 'Sin procesar',
    rows: costs ? Math.max(0, costs.getLastRow() - 1) : 0
  };
}
