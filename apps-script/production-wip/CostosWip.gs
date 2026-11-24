/*
 * Añadir este archivo al proyecto SyncExcel existente. No crea activadores.
 * sincronizarDatos() registra las versiones de los lotes copiados.
 * calcularKPIs() llama a sincronizarCostosWip_(ss) después de KPI_ALERTAS.
 * Usa leerExcel() y escribirHoja() del mismo proyecto.
 */
const PCC_WIP_EU_FILE_ID = '16PevHEnfdpGwSm1BEowDdYQWFKDoKJXb';
const PCC_WIP_TEX_FILE_ID = '1h2Y7_HAfz1_XjXDqCYN10aeHqBy85ex_';
const PCC_WIP_HOJA = 'WIP_COSTOS';
const PCC_WIP_CONTROL = 'CONTROL_WIP';
const PCC_WIP_CIERRES = 'OPS_WIP_CIERRES';
const PCC_WIP_CIERRES_HEADER = ['FECHA_CORTE', 'UNIDADES_WIP', 'VALOR_CONOCIDO_COP', 'OP_ACTIVAS', 'OP_CON_COSTO'];
const PCC_OPS_PRIMER_CIERRE = '2026-11-30';
const PCC_OPS_CIERRES = 'OPS_CIERRES';
const PCC_OPS_CIERRES_HEADER = ['FECHA_CORTE','EFICIENCIA','RENTABILIDAD','CUMPLIMIENTO','UNIDADES_CALIDAD','UNIDADES_NO_CONFORMES','MODULOS_CON_DATOS','MODULOS_CONFIGURADOS'];
const PCC_WIP_PROP = 'PCC_WIP_COSTOS_FUENTES_V1';
const PCC_WIP_LOTES_COPIADOS_PROP = 'PCC_WIP_LOTES_COPIADOS_V1';
const PCC_WIP_ARCHIVOS = [['lotEu','Lotes EU'],['lotTex','Lotes TEX'],['costEu','Costos EU'],['costTex','Costos TEX']];

function pccWipFechas_(versions) {
  return PCC_WIP_ARCHIVOS.map(function(item) {
    return {label:item[1], date:Utilities.formatDate(new Date(versions[item[0]]), 'America/Bogota', 'yyyy-MM-dd')};
  });
}

function pccWipVersiones_(euFile, texFile) {
  var versions = pccWipVersionesLotes_();
  versions.costEu = euFile.getLastUpdated().getTime();
  versions.costTex = texFile.getLastUpdated().getTime();
  return versions;
}

function pccWipPaquete_(cutoff, versions) {
  return [cutoff].concat(PCC_WIP_ARCHIVOS.map(function(item) { return versions[item[0]]; })).join('|');
}

function pccWipValidarFechas_(cutoff, versions, lateConfirmed) {
  var dates = pccWipFechas_(versions);
  var detail = function(files) { return files.map(function(file) { return file.label + ' ' + file.date; }).join(', '); };
  var before = dates.filter(function(file) { return file.date < cutoff; });
  if (before.length) throw new Error('Anteriores al corte ' + cutoff + ': ' + detail(before) + '. Sustituye esos Excel por los del corte real.');
  var late = dates.filter(function(file) { return Date.parse(file.date) - Date.parse(cutoff) > 86400000; });
  if (late.length && !lateConfirmed) throw new Error('Cargados más de un día después del corte ' + cutoff + ': ' + detail(late) + '. Confirma el corte de los cuatro Excel en el panel.');
}

function pccWipVersionesLotes_() {
  return {
    lotEu: DriveApp.getFileById(EU_FILE_ID).getLastUpdated().getTime(),
    lotTex: DriveApp.getFileById(TEX_FILE_ID).getLastUpdated().getTime()
  };
}

function pccWipRegistrarLotesCopiados_(before) {
  var after = pccWipVersionesLotes_();
  if (before.lotEu !== after.lotEu || before.lotTex !== after.lotTex) {
    throw new Error('Los Excel de lotes cambiaron mientras se copiaban. Repite sincronizarDatos.');
  }
  PropertiesService.getScriptProperties().setProperty(PCC_WIP_LOTES_COPIADOS_PROP, JSON.stringify(after));
}

function pccWipTexto_(value) {
  return String(value == null ? '' : value).trim();
}

function pccWipColumna_(value) {
  return pccWipTexto_(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ');
}

function pccWipNumero_(value, etiqueta) {
  if (typeof value === 'number' && isFinite(value)) return value;
  var raw = pccWipTexto_(value).replace(/[$\s\u00a0]/g, '');
  if (!raw) throw new Error('Costo vacío: ' + etiqueta);
  if (raw.indexOf('.') >= 0 && raw.indexOf(',') >= 0) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.indexOf(',') >= 0) {
    raw = raw.replace(',', '.');
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw new Error('Costo inválido: ' + etiqueta);
  var result = Number(raw);
  if (!isFinite(result)) throw new Error('Costo inválido: ' + etiqueta);
  return result;
}

function pccWipFecha_(value) {
  var date = value instanceof Date && !isNaN(value.getTime())
    ? Utilities.formatDate(value, 'America/Bogota', 'yyyy-MM-dd')
    : pccWipTexto_(value);
  var match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var parsed = match ? new Date(date + 'T12:00:00Z') : null;
  if (!parsed || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Escribe la fecha de corte en CONTROL_WIP!B2 como AAAA-MM-DD.');
  }
  return date;
}

function pccWipLeerCostos_(workbook, empresa) {
  var required = ['O.P. NUMERO', 'ESTADO OP:', 'REAL ACUM. MP', 'REAL ACUM. MO', 'REAL ACUM. CIF', 'REAL ACUM.'];
  var sheets = Object.keys(workbook);
  for (var s = 0; s < sheets.length; s++) {
    var rows = workbook[sheets[s]];
    for (var h = 0; h < Math.min(rows.length, 10); h++) {
      var header = rows[h].map(pccWipColumna_);
      var cols = required.map(function(name) { return header.indexOf(name); });
      if (cols.some(function(i) { return i < 0; })) continue;
      var seen = {};
      var out = [];
      for (var r = h + 1; r < rows.length; r++) {
        var row = rows[r];
        var op = pccWipTexto_(row[cols[0]]).toUpperCase();
        if (!op) continue;
        if (!/^OP-\d+$/.test(op)) throw new Error(empresa + ': OP inválida en fila ' + (r + 1));
        if (seen[op]) throw new Error(empresa + ': OP repetida: ' + op);
        seen[op] = true;
        var values = cols.slice(2).map(function(c, i) {
          return pccWipNumero_(row[c], empresa + ' ' + op + ' ' + required[i + 2]);
        });
        if (values.some(function(n) { return n < 0; })) throw new Error(empresa + ': costo negativo en ' + op);
        if (Math.abs(values[0] + values[1] + values[2] - values[3]) > 0.05) {
          throw new Error(empresa + ': MP + MO + CIF no coincide con el total de ' + op);
        }
        out.push([empresa, op, pccWipTexto_(row[cols[1]]), values[0], values[1], values[2], values[3]]);
      }
      if (!out.length) throw new Error(empresa + ': informe de costos sin OP');
      return out;
    }
  }
  throw new Error(empresa + ': no se encontraron los encabezados de COSTOS WIP');
}

function pccWipApi_(method, path, body) {
  var options = {
    method: method,
    contentType: 'application/json',
    headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    muteHttpExceptions: true
  };
  if (body != null) options.payload = JSON.stringify(body);
  var response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(KPI_SPREADSHEET_ID) + path, options);
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Sheets API HTTP ' + code + ': ' + response.getContentText().slice(0, 400));
  }
  return JSON.parse(response.getContentText());
}

function pccWipRango_(range) {
  return '/values/' + encodeURIComponent(range);
}

function pccWipValores_(range) {
  return pccWipApi_('get', pccWipRango_(range) + '?valueRenderOption=FORMATTED_VALUE').values || [];
}

function pccWipEscribir_(range, values) {
  return pccWipApi_('put', pccWipRango_(range) + '?valueInputOption=RAW', {values: values});
}

function pccWipEstado_(ss, message) {
  pccWipEscribir_(PCC_WIP_CONTROL + '!A3:B3', [['Estado de costos WIP', message]]);
}

function pccWipCeldas_(row) {
  return {values: row.map(function(value) {
    return {userEnteredValue: typeof value === 'number' ? {numberValue: value} : {stringValue: String(value)}};
  })};
}

function pccWipFinDeMes_(cutoff) {
  var parts = cutoff.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1], 0)).getUTCDate() === parts[2];
}

function pccWipResumenCierre_(cutoff, euLots, texLots, costRows) {
  var costs = new Map(costRows.slice(1).map(function(row) { return [row[1] + '|' + row[2], row[7]]; }));
  var active = new Set();
  var units = 0;
  [['EU', euLots], ['TEX', texLots]].forEach(function(source) {
    var empresa = source[0];
    var rows = source[1];
    var header = (rows[0] || []).map(pccWipColumna_);
    var stateCol = header.indexOf('ESTADO');
    var opCol = header.indexOf('ORDEN DE CORTE');
    var unitsCol = header.indexOf('CANT');
    if (Math.min(stateCol, opCol, unitsCol) < 0) throw new Error('Encabezados incompletos en ' + empresa + '_Lotes para el cierre.');
    rows.slice(1).forEach(function(row) {
      var state = pccWipColumna_(row[stateCol]);
      if (!state || state === 'ENTREGADO' || state === 'CANCELADO') return;
      var quantity = pccWipNumero_(row[unitsCol], empresa + ' unidades WIP');
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error('Cantidad no válida para el cierre WIP ' + empresa);
      if (!quantity) return;
      var op = pccWipColumna_(row[opCol]);
      if (!op) throw new Error('Lote activo sin OP para el cierre WIP ' + empresa);
      units += quantity;
      active.add(empresa + '|' + op);
    });
  });
  var matched = 0;
  var value = 0;
  active.forEach(function(key) {
    if (!costs.has(key)) return;
    matched++;
    value += costs.get(key);
  });
  return [cutoff, units, matched || !units ? Math.round(value * 100) / 100 : '', active.size, matched];
}

function pccOpsSolicitudesArchivo_(summary, name, columns, byName, sheets, stageId) {
  var id = byName[name];
  if (id != null) {
    var rows = pccWipValores_(name + '!A:' + String.fromCharCode(64 + columns.length));
    var header = rows[0] || [];
    if (!columns.every(function(value, i) { return header[i] === value; })) {
      throw new Error('Encabezados inesperados en ' + name);
    }
    var registered = rows.slice(1).some(function(row) { return row[0] === summary[0]; });
    return registered ? [] : [{appendCells: {sheetId: id, rows: [pccWipCeldas_(summary)], fields: 'userEnteredValue'}}];
  }
  id = stageId + 1;
  while (sheets.some(function(sheet) { return sheet.properties.sheetId === id; })) id++;
  return [
    {addSheet: {properties: {sheetId: id, title: name, gridProperties: {frozenRowCount: 1}}}},
    {updateCells: {start: {sheetId: id, rowIndex: 0, columnIndex: 0},
      rows: [pccWipCeldas_(columns), pccWipCeldas_(summary)], fields: 'userEnteredValue'}}
  ];
}

function registrarCierreOperaciones(payload) {
  var row;
  try { row = JSON.parse(payload); }
  catch (error) { throw new Error('Pega el cierre generado en Operaciones → Históricos.'); }
  if (!Array.isArray(row) || row.length !== PCC_OPS_CIERRES_HEADER.length) throw new Error('El cierre tiene un formato inválido.');
  var cutoff = pccWipFecha_(row[0]);
  var today = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  if (cutoff < PCC_OPS_PRIMER_CIERRE || cutoff >= today || !pccWipFinDeMes_(cutoff)) {
    throw new Error('El cierre debe ser de un mes terminado, a partir del 30 de noviembre de 2026.');
  }
  if (row.slice(1, 4).some(function(value) { return value !== null && !Number.isFinite(value); }) ||
      ((row[4] !== null || row[5] !== null) && (!Number.isSafeInteger(row[4]) || row[4] <= 0 || !Number.isSafeInteger(row[5]) || row[5] < 0 || row[5] > row[4])) ||
      !Number.isSafeInteger(row[6]) || !Number.isSafeInteger(row[7]) || row[6] < 1 || row[6] > row[7]) {
    throw new Error('El cierre contiene indicadores o recuentos inválidos.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheets = (pccWipApi_('get', '?fields=sheets(properties(sheetId,title))')).sheets || [];
    var byName = {};
    sheets.forEach(function(sheet) { byName[sheet.properties.title] = sheet.properties.sheetId; });
    var cells = row.map(function(value) { return value === null ? '' : value; });
    var requests = pccOpsSolicitudesArchivo_(cells, PCC_OPS_CIERRES, PCC_OPS_CIERRES_HEADER, byName, sheets, 1000000000);
    if (!requests.length) return 'El cierre del ' + cutoff + ' ya está registrado.';
    pccWipApi_('post', ':batchUpdate', {requests: requests});
    return 'Cierre de Operaciones registrado para el ' + cutoff + '.';
  } finally { lock.releaseLock(); }
}

function pccWipPublicar_(ss, rows, summary) {
  var sheets = pccWipApi_('get', '?fields=sheets(properties(sheetId,title))').sheets || [];
  var byName = {};
  sheets.forEach(function(s) { byName[s.properties.title] = s.properties.sheetId; });
  var stageName = 'WIP_COSTOS_NUEVO';
  var stageId = Math.floor(Math.random() * 1000000000) + 1000000000;
  while (sheets.some(function(s) { return s.properties.sheetId === stageId; })) stageId++;
  var requests = [];
  if (byName[stageName] != null) requests.push({deleteSheet: {sheetId: byName[stageName]}});
  requests.push({addSheet: {properties: {sheetId: stageId, title: stageName,
    gridProperties: {rowCount: Math.max(1000, rows.length), columnCount: Math.max(26, rows[0].length)}}}});
  requests.push({updateCells: {start: {sheetId: stageId, rowIndex: 0, columnIndex: 0},
    rows: rows.map(pccWipCeldas_), fields: 'userEnteredValue'}});
  if (byName[PCC_WIP_HOJA] != null) requests.push({deleteSheet: {sheetId: byName[PCC_WIP_HOJA]}});
  requests.push({updateSheetProperties: {properties: {sheetId: stageId, title: PCC_WIP_HOJA}, fields: 'title'}});
  if (summary) requests = requests.concat(pccOpsSolicitudesArchivo_(summary, PCC_WIP_CIERRES, PCC_WIP_CIERRES_HEADER, byName, sheets, stageId));
  pccWipApi_('post', ':batchUpdate', {requests: requests});
}

function sincronizarCostosWip_(ss) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    pccWipSincronizar_(ss);
  } catch (error) {
    Logger.log('WIP causa original: ' + (error.stack || error));
    try { pccWipEstado_(ss, 'ERROR: ' + String(error.message || error).slice(0, 180)); }
    catch (statusError) { Logger.log('No se pudo registrar el estado WIP: ' + statusError); }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function pccWipSincronizar_(ss) {
  var euFile = DriveApp.getFileById(PCC_WIP_EU_FILE_ID);
  var texFile = DriveApp.getFileById(PCC_WIP_TEX_FILE_ID);
  var versions = pccWipVersiones_(euFile, texFile);
  var props = PropertiesService.getScriptProperties();
  var previous = JSON.parse(props.getProperty(PCC_WIP_PROP) || '{}');
  var keys = ['lotEu', 'lotTex', 'costEu', 'costTex'];
  var same = keys.every(function(key) { return previous[key] === versions[key]; });
  var published = (pccWipApi_('get', '?fields=sheets(properties(title))').sheets || [])
    .some(function(sheet) { return sheet.properties.title === PCC_WIP_HOJA; });
  if (published && same) {
    pccWipEstado_(ss, 'PUBLICADO: corte ' + previous.cutoff + ' · los cuatro Excel ya se procesaron.');
    Logger.log('WIP costos: mismos cuatro Excel; no se reprocesan.');
    return;
  }
  if (previous.cutoff && !same && keys.some(function(key) { return previous[key] === versions[key]; })) {
    pccWipEstado_(ss, 'PENDIENTE: faltan archivos nuevos del paquete de cuatro Excel WIP.');
    Logger.log('WIP costos: paquete de cuatro Excel incompleto.');
    return;
  }
  var copied = JSON.parse(props.getProperty(PCC_WIP_LOTES_COPIADOS_PROP) || 'null');
  if (!copied || copied.lotEu !== versions.lotEu || copied.lotTex !== versions.lotTex) {
    pccWipEstado_(ss, 'PENDIENTE: ejecuta sincronizarDatos para copiar estos Excel de lotes.');
    Logger.log('WIP costos: las hojas de lotes no corresponden a los Excel actuales.');
    return;
  }
  pccWipEstado_(ss, 'VALIDANDO');
  var cutoffRows = pccWipValores_(PCC_WIP_CONTROL + '!B2:B4');
  var cutoff = pccWipFecha_(cutoffRows[0] && cutoffRows[0][0]);
  var confirmation = cutoffRows[2] && cutoffRows[2][0];
  pccWipValidarFechas_(cutoff, versions, confirmation === pccWipPaquete_(cutoff, versions));
  if (previous.cutoff && cutoff < previous.cutoff) throw new Error('El corte WIP no puede retroceder.');

  var eu = pccWipLeerCostos_(leerExcel(PCC_WIP_EU_FILE_ID), 'EU');
  var tex = pccWipLeerCostos_(leerExcel(PCC_WIP_TEX_FILE_ID), 'TEX');
  var header = ['FECHA_CORTE', 'EMPRESA', 'ORDEN', 'ESTADO_EXCEL', 'MP_COP', 'MO_COP', 'CIF_COP', 'TOTAL_COP', 'ARCHIVO_ACTUALIZADO'];
  var rows = [header];
  eu.forEach(function(r) { rows.push([cutoff].concat(r, Utilities.formatDate(new Date(versions.costEu), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'))); });
  tex.forEach(function(r) { rows.push([cutoff].concat(r, Utilities.formatDate(new Date(versions.costTex), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'))); });
  var summary = null;
  if (cutoff >= PCC_OPS_PRIMER_CIERRE && pccWipFinDeMes_(cutoff)) {
    var euLots = pccWipApi_('get', pccWipRango_('EU_Lotes!A:J') + '?valueRenderOption=UNFORMATTED_VALUE').values || [];
    var texLots = pccWipApi_('get', pccWipRango_('TEX_Lotes!A:J') + '?valueRenderOption=UNFORMATTED_VALUE').values || [];
    summary = pccWipResumenCierre_(cutoff, euLots, texLots, rows);
  }
  var unchanged = pccWipVersionesLotes_();
  if (unchanged.lotEu !== versions.lotEu || unchanged.lotTex !== versions.lotTex ||
      euFile.getLastUpdated().getTime() !== versions.costEu || texFile.getLastUpdated().getTime() !== versions.costTex) {
    throw new Error('Uno de los cuatro Excel cambió durante el procesamiento. Repite la ejecución.');
  }
  pccWipPublicar_(ss, rows, summary);
  props.setProperty(PCC_WIP_PROP, JSON.stringify({lotEu: versions.lotEu, lotTex: versions.lotTex, costEu: versions.costEu, costTex: versions.costTex, cutoff: cutoff}));
  pccWipEstado_(ss, 'PUBLICADO: corte ' + cutoff + ' · EU ' + eu.length + ' OP · TEX ' + tex.length + ' OP');
  Logger.log('WIP costos: ' + (rows.length - 1) + ' OP publicadas para ' + cutoff);
}
