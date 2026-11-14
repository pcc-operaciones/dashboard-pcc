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
const PCC_WIP_PROP = 'PCC_WIP_COSTOS_FUENTES_V1';
const PCC_WIP_LOTES_COPIADOS_PROP = 'PCC_WIP_LOTES_COPIADOS_V1';

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

function pccWipEstado_(ss, message) {
  var control = ss.getSheetByName(PCC_WIP_CONTROL);
  if (!control) control = ss.insertSheet(PCC_WIP_CONTROL);
  control.getRange('A2').setValue('Fecha de corte EU y TEX (AAAA-MM-DD)');
  control.getRange('A3').setValue('Estado de costos WIP');
  control.getRange('B3').setValue(message);
  return control;
}

function pccWipPublicar_(ss, rows) {
  var stageName = 'WIP_COSTOS_NUEVO';
  var backupName = 'WIP_COSTOS_ANTERIOR';
  var old = ss.getSheetByName(PCC_WIP_HOJA);
  var backup = ss.getSheetByName(backupName);
  if (!old && backup) { backup.setName(PCC_WIP_HOJA); old = backup; backup = null; }
  if (backup) ss.deleteSheet(backup);
  var stage = ss.getSheetByName(stageName);
  if (stage) ss.deleteSheet(stage);
  stage = ss.insertSheet(stageName);
  try {
    escribirHoja(ss, stageName, rows);
    if (stage.getLastRow() !== rows.length) throw new Error('No se escribió todo el corte WIP.');
    if (old) old.setName(backupName);
    try {
      stage.setName(PCC_WIP_HOJA);
    } catch (error) {
      if (old) old.setName(PCC_WIP_HOJA);
      throw error;
    }
    if (old) ss.deleteSheet(old);
  } catch (error) {
    if (stage.getName() === stageName) ss.deleteSheet(stage);
    throw error;
  }
}

function sincronizarCostosWip_(ss) {
  try {
    pccWipSincronizar_(ss);
  } catch (error) {
    pccWipEstado_(ss, 'ERROR: ' + String(error.message || error).slice(0, 180));
    throw error;
  }
}

function pccWipSincronizar_(ss) {
  var euFile = DriveApp.getFileById(PCC_WIP_EU_FILE_ID);
  var texFile = DriveApp.getFileById(PCC_WIP_TEX_FILE_ID);
  var versions = pccWipVersionesLotes_();
  versions.costEu = euFile.getLastUpdated().getTime();
  versions.costTex = texFile.getLastUpdated().getTime();
  var props = PropertiesService.getScriptProperties();
  var previous = JSON.parse(props.getProperty(PCC_WIP_PROP) || '{}');
  var keys = ['lotEu', 'lotTex', 'costEu', 'costTex'];
  var same = keys.every(function(key) { return previous[key] === versions[key]; });
  if (ss.getSheetByName(PCC_WIP_HOJA) && same) {
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
  var control = pccWipEstado_(ss, 'VALIDANDO');
  var cutoff = pccWipFecha_(control.getRange('B2').getValue());
  keys.map(function(key) { return versions[key]; }).forEach(function(version) {
    var uploadDate = Utilities.formatDate(new Date(version), 'America/Bogota', 'yyyy-MM-dd');
    var lagDays = Math.floor((Date.parse(uploadDate + 'T12:00:00Z') - Date.parse(cutoff + 'T12:00:00Z')) / 86400000);
    if (lagDays < 0 || lagDays > 1) {
      throw new Error('La fecha de CONTROL_WIP!B2 debe ser la del cargue de los cuatro Excel o el día anterior.');
    }
  });
  if (previous.cutoff && cutoff < previous.cutoff) throw new Error('El corte WIP no puede retroceder.');

  var eu = pccWipLeerCostos_(leerExcel(PCC_WIP_EU_FILE_ID), 'EU');
  var tex = pccWipLeerCostos_(leerExcel(PCC_WIP_TEX_FILE_ID), 'TEX');
  var header = ['FECHA_CORTE', 'EMPRESA', 'ORDEN', 'ESTADO_EXCEL', 'MP_COP', 'MO_COP', 'CIF_COP', 'TOTAL_COP', 'ARCHIVO_ACTUALIZADO'];
  var rows = [header];
  eu.forEach(function(r) { rows.push([cutoff].concat(r, Utilities.formatDate(new Date(versions.costEu), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'))); });
  tex.forEach(function(r) { rows.push([cutoff].concat(r, Utilities.formatDate(new Date(versions.costTex), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'))); });
  var unchanged = pccWipVersionesLotes_();
  if (unchanged.lotEu !== versions.lotEu || unchanged.lotTex !== versions.lotTex ||
      euFile.getLastUpdated().getTime() !== versions.costEu || texFile.getLastUpdated().getTime() !== versions.costTex) {
    throw new Error('Uno de los cuatro Excel cambió durante el procesamiento. Repite la ejecución.');
  }
  pccWipPublicar_(ss, rows);
  props.setProperty(PCC_WIP_PROP, JSON.stringify({lotEu: versions.lotEu, lotTex: versions.lotTex, costEu: versions.costEu, costTex: versions.costTex, cutoff: cutoff}));
  pccWipEstado_(ss, 'PUBLICADO: corte ' + cutoff + ' · EU ' + eu.length + ' OP · TEX ' + tex.length + ' OP');
  Logger.log('WIP costos: ' + (rows.length - 1) + ' OP publicadas para ' + cutoff);
}
