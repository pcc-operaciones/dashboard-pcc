(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PccOpsHistoryModel = api;
})(globalThis, function() {
  'use strict';

  const firstMonth = '2026-11';
  const months = 'ENERO FEBRERO MARZO ABRIL MAYO JUNIO JULIO AGOSTO SEPTIEMBRE OCTUBRE NOVIEMBRE DICIEMBRE'.split(' ');
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
  const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const blank = value => value === '' || value == null;
  const period = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
  const opsHeader = ['FECHA_CORTE','EFICIENCIA','RENTABILIDAD','CUMPLIMIENTO','UNIDADES_CALIDAD','UNIDADES_NO_CONFORMES','MODULOS_CON_DATOS','MODULOS_CONFIGURADOS'];
  const wipHeader = ['FECHA_CORTE','UNIDADES_WIP','VALOR_CONOCIDO_COP','OP_ACTIVAS','OP_CON_COSTO'];

  function previousMonth(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Bogota', year:'numeric', month:'numeric'}).formatToParts(now);
    const year = Number(parts.find(part => part.type === 'year').value);
    const month = Number(parts.find(part => part.type === 'month').value);
    return month === 1 ? period(year - 1, 12) : period(year, month - 1);
  }

  function monthEnd(key) {
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(key)) return '';
    const [year, month] = key.split('-').map(Number);
    return `${key}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
  }

  function eligibleCutoff(config, now) {
    const index = months.indexOf(normalize(config?.mes));
    const key = period(config?.año, index + 1);
    return key >= firstMonth && key === previousMonth(now) ? monthEnd(key) : '';
  }

  function qualityMonth(value) {
    if (typeof value === 'number' && value > 40000 && value < 100000) {
      return new Date((Math.floor(value) - 25569) * 86400000).toISOString().slice(0, 7);
    }
    const raw = String(value ?? '').trim();
    const iso = raw.match(/^(20\d{2})-(\d{2})-(\d{2})(?:$|[T ])/);
    const local = raw.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
    if (!iso && !local) return '';
    const key = iso ? period(iso[1], iso[2]) : period(local[3], local[2]);
    const day = Number(iso ? iso[3] : local[1]);
    const end = monthEnd(key);
    return end && day > 0 && day <= Number(end.slice(-2)) ? key : '';
  }

  function qualityForMonth(rows, key) {
    const header = (rows[0] || []).map(normalize);
    const [opCol, unitsCol, ncCol, dateCol] = ['O.P. NUMERO','CANTIDAD OP','NO CONFORMES COSTURA','FF PRESENTACION'].map(label => header.indexOf(label));
    if (Math.min(opCol, unitsCol, ncCol, dateCol) < 0) throw new Error('Encabezados de calidad incompletos.');
    let units = 0;
    let nonconforming = 0;
    for (const row of rows.slice(1)) {
      if (!row[opCol] || qualityMonth(row[dateCol]) !== key) continue;
      const qty = row[unitsCol];
      const nc = row[ncCol];
      if (count(qty) && qty > 0 && count(nc) && nc <= qty) {
        units += qty;
        nonconforming += nc;
      }
    }
    return units > 0 ? [units, nonconforming] : [null, null];
  }

  function snapshot(cutoff, modules, expected, quality, summarize) {
    const lastDay = Number(cutoff.slice(-2));
    const periodModules = modules.map(module => ({...module, daily:module.daily.filter(day => Number.isInteger(day.dia) && day.dia >= 1 && day.dia <= lastDay)}));
    const withData = periodModules.filter(module => module.daily.some(day => day.pro > 0 || day.real > 0 || day.ing > 0));
    if (!withData.length) throw new Error('El período no tiene actividad válida para cerrar.');
    const metrics = ['ef','util','cumpl'].map(metric => summarize(periodModules, metric));
    return [cutoff, ...metrics, ...quality, withData.length, expected];
  }

  function readRows(rows, header, parse) {
    const result = new Map();
    if (!rows.length) return result;
    const columns = rows[0].map(normalize);
    const indexes = header.map(label => columns.indexOf(label));
    if (indexes.includes(-1)) throw new Error('Encabezados de cierres incompletos.');
    for (const row of rows.slice(1)) {
      if (row.every(blank)) continue;
      const values = indexes.map(index => row[index]);
      const cutoff = String(values[0] ?? '');
      const key = cutoff.slice(0, 7);
      if (!cutoff || cutoff !== monthEnd(key)) throw new Error('Fecha de cierre inválida.');
      if (key < firstMonth) continue;
      if (result.has(key)) throw new Error('Fecha de cierre repetida.');
      result.set(key, parse(values));
    }
    return result;
  }

  function readOps(rows) {
    return readRows(rows, opsHeader, ([cutoff, efficiency, profitability, compliance, units, nonconforming, loaded, expected]) => {
      if ([efficiency, profitability, compliance].some(value => !blank(value) && number(value) === null) ||
          (!blank(units) || !blank(nonconforming)) && (!count(units) || !count(nonconforming) || units <= 0 || nonconforming > units) ||
          !count(loaded) || loaded < 1 || !count(expected) || loaded > expected) throw new Error('Indicadores de cierre inválidos.');
      return {cutoff, efficiency:number(efficiency), profitability:number(profitability), compliance:number(compliance), units:number(units), nonconforming:number(nonconforming), loaded, expected};
    });
  }

  function readWip(rows) {
    return readRows(rows, wipHeader, ([, units, value, active, matched]) => {
      const known = number(value);
      if (![units, active, matched].every(count) || active > units || matched > active ||
          (!blank(value) && (known === null || known < 0)) || (matched > 0 && known === null) || (matched === 0 && known > 0)) {
        throw new Error('Cierre WIP inválido.');
      }
      return {units, value: matched > 0 || units === 0 ? known : null, active, matched};
    });
  }

  function compile(ops, wip, limit = previousMonth()) {
    return [...ops.keys()].filter(key => key >= firstMonth && key <= limit).sort().reverse().map(key => ({key, ...ops.get(key), wip:wip.get(key)}));
  }

  return {firstMonth, eligibleCutoff, qualityForMonth, snapshot, readOps, readWip, compile};
});
