(function() {
  'use strict';
  const model = window.PccOpsHistoryModel;
  const get = id => document.getElementById(`ops-history-${id}`);
  const quantity = new Intl.NumberFormat('es-CO');
  const percent = new Intl.NumberFormat('es-CO', {style:'percent', maximumFractionDigits:2});
  const currency = new Intl.NumberFormat('es-CO', {style:'currency', currency:'COP', maximumFractionDigits:2});
  const month = new Intl.DateTimeFormat('es-CO', {month:'long', year:'numeric', timeZone:'UTC'});
  const format = (formatter, value) => value == null ? '—' : formatter.format(value);
  let rows = [];
  let pending;
  let loaded = false;

  function render() {
    const year = get('year').value;
    const visible = rows.filter(row => !year || row.key.startsWith(year));
    get('caption').textContent = year ? `Indicadores mensuales de ${year}` : 'Indicadores mensuales de Operaciones';
    get('empty').hidden = visible.length > 0;
    get('empty').textContent = rows.length ? 'No hay cierres registrados para este año.' : 'Primer cierre previsto para el 30 de noviembre de 2026. Pendiente de registro.';
    get('table').hidden = visible.length === 0;
    get('body').replaceChildren(...visible.map(row => {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = month.format(new Date(`${row.key}-01T12:00:00Z`));
      tr.append(th);
      const wip = row.wip;
      const metrics = [
        [format(percent, row.efficiency), `${row.loaded} de ${row.expected} módulos con actividad`],
        [format(percent, row.profitability)], [format(percent, row.compliance)],
        [row.units > 0 ? format(percent, row.nonconforming / row.units) : '—',
          row.units > 0 ? `${quantity.format(row.nonconforming)} de ${quantity.format(row.units)} uds.` : ''],
        [format(quantity, wip?.units)],
        [format(currency, wip?.value), wip ? `${quantity.format(wip.matched)} de ${quantity.format(wip.active)} OP con costo` : 'Sin corte'],
      ];
      for (const [value, note] of metrics) {
        const cell = tr.insertCell();
        cell.textContent = value;
        if (note) {
          const sub = document.createElement('small');
          sub.textContent = note;
          cell.append(sub);
        }
      }
      return tr;
    }));
  }

  async function load(read, config, collect, force = false) {
    if (pending) return pending;
    const sources = [
      ['Operaciones', 'OPS_CIERRES', 'A:H', model.readOps],
      ['WIP', 'OPS_WIP_CIERRES', 'A:E', model.readWip],
    ];
    const cutoff = model.eligibleCutoff(config);
    const button = get('prepare');
    if (loaded && !force) {
      button.hidden = !cutoff || rows.some(row => row.cutoff === cutoff);
      return;
    }
    button.hidden = true;
    get('status').textContent = 'Consultando los cierres registrados…';
    get('panel').setAttribute('aria-busy', 'true');
    pending = Promise.allSettled(sources.map(async ([, sheet, range, parse]) => {
      try {
        return parse(await read(sheet, range));
      } catch (error) {
        if (error.status === 400 && (/Unable to parse range/i.test(error.message) || error.code === 'SOURCE_UNAVAILABLE')) return new Map();
        throw error;
      }
    })).then(results => {
      const unavailable = sources.filter((_, i) => results[i].status === 'rejected').map(([label]) => label);
      const data = results.map(result => result.status === 'fulfilled' ? result.value : new Map());
      rows = model.compile(...data);
      const selected = get('year').value;
      const years = [...new Set(rows.map(row => row.key.slice(0, 4)))];
      get('year').replaceChildren(new Option('Todos los años', ''), ...years.map(year => new Option(year, year)));
      get('year').value = years.includes(selected) ? selected : '';
      get('year').onchange = render;
      const messages = [];
      if (unavailable.length) messages.push(`Fuentes no disponibles: ${unavailable.join(', ')}.`);
      get('status').textContent = messages.join(' ');
      loaded = unavailable.length === 0;
      button.hidden = !cutoff || unavailable.includes('Operaciones') || data[0].has(cutoff.slice(0, 7));
      if (button.hidden) {
        get('snapshot').hidden = true;
        get('capture-status').textContent = '';
      }
      button.onclick = async () => {
        const output = get('snapshot');
        const status = get('capture-status');
        output.hidden = true;
        button.disabled = true;
        status.textContent = `Preparando el cierre del ${cutoff}…`;
        try {
          const result = await collect(cutoff);
          const [,,,, units,, active, expected] = result;
          get('payload').value = JSON.stringify(result);
          output.hidden = false;
          status.textContent = `Cierre preparado con actividad en ${active} de ${expected} módulos.${units == null ? ' Calidad sin datos válidos del período.' : ''}`;
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
      render();
    }).finally(() => {
      get('panel').removeAttribute('aria-busy');
      pending = null;
    });
    return pending;
  }

  window.PccOpsHistory = {load, scope: () => get('year').value || 'Todos los años'};
})();
