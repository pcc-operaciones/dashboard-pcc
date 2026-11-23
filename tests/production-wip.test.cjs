const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/production-wip/CostosWip.gs'), 'utf8');
const header = ['O.P. Número', 'ESTADO OP:', 'Real acum. MP', 'Real acum. MO', 'Real acum. CIF', 'Real acum.'];

function context(overrides = {}) {
  const sandbox = {
    Date, JSON, String, Number, Object, Array, Math, Error, isFinite,
    LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}})},
    Utilities: {formatDate: (date, tz, format) => format === 'yyyy-MM-dd'
      ? date.toISOString().slice(0, 10) : date.toISOString().replace('T', ' ').slice(0, 19)},
    ...overrides,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

test('lee EU y TEX por encabezado aun con columna inicial vacía', () => {
  const app = context();
  const eu = app.pccWipLeerCostos_({Sheet1: [header, ['OP-00001', 'CORTE', 100, 20, 5, 125]]}, 'EU');
  const tex = app.pccWipLeerCostos_({Sheet1: [['', ...header], ['', 'OP-00002', 'COSTEO', 90, 10, 0, 100]]}, 'TEX');
  assert.deepEqual(JSON.parse(JSON.stringify(eu)), [['EU', 'OP-00001', 'CORTE', 100, 20, 5, 125]]);
  assert.deepEqual(JSON.parse(JSON.stringify(tex)), [['TEX', 'OP-00002', 'COSTEO', 90, 10, 0, 100]]);
});

test('rechaza OP repetida y total que no concilia', () => {
  const app = context();
  assert.throws(() => app.pccWipLeerCostos_({Sheet1: [header,
    ['OP-00001', 'CORTE', 100, 20, 5, 125],
    ['OP-00001', 'CORTE', 100, 20, 5, 125]]}, 'EU'), /repetida/);
  assert.throws(() => app.pccWipLeerCostos_({Sheet1: [header,
    ['OP-00001', 'CORTE', 100, 20, 5, 130]]}, 'EU'), /no coincide/);
});

test('mantiene el último corte si falta reemplazar uno de los cuatro Excel', () => {
  const messages = [];
  const props = {lotEu: 1000, lotTex: 1000, costEu: 1000, costTex: 1000, cutoff: '2026-11-12'};
  const app = context({
    EU_FILE_ID: 'lot-eu', TEX_FILE_ID: 'lot-tex',
    DriveApp: {getFileById: id => ({getLastUpdated: () => new Date(id === 'lot-tex' ? 1000 : 2000)})},
    PropertiesService: {getScriptProperties: () => ({getProperty: () => JSON.stringify(props)})},
    Logger: {log: value => messages.push(value)},
  });
  app.pccWipApi_ = (method, path, body) => {
    if (path.includes('fields=')) return {sheets: [{properties: {title: 'WIP_COSTOS'}}]};
    messages.push(body.values[0][1]); return {};
  };
  app.sincronizarCostosWip_({});
  assert.ok(messages.some(message => String(message).includes('PENDIENTE')));
});

test('espera la copia de los lotes si cambiaron después de sincronizarDatos', () => {
  const messages = [];
  const app = context({
    EU_FILE_ID: 'lot-eu', TEX_FILE_ID: 'lot-tex',
    DriveApp: {getFileById: () => ({getLastUpdated: () => new Date(2000)})},
    PropertiesService: {getScriptProperties: () => ({getProperty: name => name.includes('LOTES_COPIADOS')
      ? JSON.stringify({lotEu: 1000, lotTex: 1000}) : '{}'})},
    Logger: {log: value => messages.push(value)},
  });
  app.pccWipApi_ = (method, path, body) => {
    if (path.includes('fields=')) return {sheets: []};
    messages.push(body.values[0][1]); return {};
  };
  app.sincronizarCostosWip_({});
  assert.ok(messages.some(message => String(message).includes('sincronizarDatos')));
});

test('publica el corte en una sola operación atómica y descarta la hoja temporal vacía', () => {
  const app = context();
  let published;
  app.pccWipApi_ = (method, path, body) => {
    if (method === 'get') return {sheets: [
      {properties: {title: 'WIP_COSTOS_NUEVO', sheetId: 21}},
      {properties: {title: 'WIP_COSTOS', sheetId: 22}}
    ]};
    published = body.requests; return {};
  };
  app.pccWipPublicar_({}, [['FECHA_CORTE', 'TOTAL_COP'], ['2026-11-12', 125]]);
  assert.equal(published[0].deleteSheet.sheetId, 21);
  assert.equal(published[1].addSheet.properties.title, 'WIP_COSTOS_NUEVO');
  assert.equal(published[2].updateCells.rows[1].values[1].userEnteredValue.numberValue, 125);
  assert.equal(published[3].deleteSheet.sheetId, 22);
  assert.equal(published[4].updateSheetProperties.properties.title, 'WIP_COSTOS');
});

test('el cierre suma unidades por lote y valor una vez por empresa y OP', () => {
  const app = context();
  const lots = ['Estado', 'Cant', 'Orden de Corte'];
  const costs = [[], ['2026-11-30', 'EU', 'OP-1', '', 0, 0, 0, 125], ['2026-11-30', 'TEX', 'OP-1', '', 0, 0, 0, 250]];
  const eu = [lots, ['CORTE', 4, 'OP-1'], ['CONFECCION', 6, 'OP-1'], ['ENTREGADO', 100, 'OP-2']];
  const tex = [lots, ['CORTE', 12, 'OP-1'], ['CORTE', 3, 'OP-4'], ['CANCELADO', 10, 'OP-9']];
  assert.deepEqual(Array.from(app.pccWipResumenCierre_('2026-11-30', eu, tex, costs)), ['2026-11-30', 25, 375, 3, 2]);
  assert.equal(app.pccWipFinDeMes_('2026-11-12'), false);
  assert.equal(app.pccWipFinDeMes_('2028-02-29'), true);
});

test('publica el primer cierre en el mismo batch y conserva el corte existente en un reintento', () => {
  const app = context();
  const summary = ['2026-11-30', 10, 125, 1, 1];
  let sheets = [];
  let requests;
  app.pccWipApi_ = (method, path, body) => {
    if (method === 'get') return {sheets};
    requests = body.requests;
    return {};
  };
  app.pccWipPublicar_({}, [['FECHA_CORTE'], ['2026-11-30']], summary);
  assert.equal(requests[3].addSheet.properties.title, 'OPS_WIP_CIERRES');
  assert.equal(requests[4].updateCells.rows[1].values[2].userEnteredValue.numberValue, 125);
  sheets = [{properties:{title:'OPS_WIP_CIERRES', sheetId:24}}];
  const columns = ['FECHA_CORTE', 'UNIDADES_WIP', 'VALOR_CONOCIDO_COP', 'OP_ACTIVAS', 'OP_CON_COSTO'];
  app.pccWipValores_ = () => [columns, summary];
  app.pccWipPublicar_({}, [['FECHA_CORTE'], ['2026-11-30']], summary);
  assert.equal(requests.length, 3);
  app.pccWipPublicar_({}, [['FECHA_CORTE'], ['2026-12-31']], ['2026-12-31', 0, 0, 0, 0]);
  assert.equal(requests[3].appendCells.sheetId, 24);
});

test('sincroniza costos y archiva únicamente el paquete del último día del mes', () => {
  const version = Date.parse('2026-12-01T17:00:00Z');
  const lotRows = [['ESTADO', 'ORDEN DE CORTE', 'CANT'], ['CORTE', 'OP-1', 10]];
  const app = context({
    EU_FILE_ID: 'lot-eu', TEX_FILE_ID: 'lot-tex',
    DriveApp: {getFileById: () => ({getLastUpdated: () => new Date(version)})},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => key.includes('LOTES_COPIADOS') ? JSON.stringify({lotEu:version, lotTex:version}) : null,
      setProperty() {},
    })},
    Logger: {log() {}},
    leerExcel: () => ({Sheet1:[header, ['OP-1', 'CORTE', 100, 0, 0, 100]]}),
  });
  let cutoff = '2026-11-30';
  let lotReads = 0;
  let published;
  app.pccWipEstado_ = () => {};
  app.pccWipValores_ = () => [[cutoff]];
  app.pccWipApi_ = (method, path) => {
    if (path.includes('_Lotes')) { lotReads++; return {values:lotRows}; }
    return {sheets:[]};
  };
  app.pccWipPublicar_ = (ss, rows, summary) => { published = [rows, summary]; };
  app.sincronizarCostosWip_({});
  assert.equal(published[0].length, 3);
  assert.deepEqual(Array.from(published[1]), ['2026-11-30', 20, 200, 2, 2]);
  cutoff = '2026-12-01';
  app.sincronizarCostosWip_({});
  assert.equal(published[1], null);
  assert.equal(lotReads, 2);
});

test('registra el primer cierre de Operaciones y mantiene la fila una sola vez', () => {
  let today = '2026-11-30';
  const app = context({Utilities:{formatDate: () => today}});
  const row = ['2026-11-30', 0.8, -0.1, null, 500, 10, 9, 10];
  const header = ['FECHA_CORTE','EFICIENCIA','RENTABILIDAD','CUMPLIMIENTO','UNIDADES_CALIDAD','UNIDADES_NO_CONFORMES','MODULOS_CON_DATOS','MODULOS_CONFIGURADOS'];
  let sheets = [];
  let writes = 0;
  app.pccWipApi_ = (method, path, body) => {
    if (method === 'get') return {sheets};
    writes++;
    assert.equal(body.requests[0].addSheet.properties.title, 'OPS_CIERRES');
    assert.equal(body.requests[1].updateCells.rows[1].values[3].userEnteredValue.stringValue, '');
    return {};
  };
  assert.throws(() => app.registrarCierreOperaciones(JSON.stringify(row)), /mes terminado/);
  today = '2026-12-01';
  assert.throws(() => app.registrarCierreOperaciones(JSON.stringify(['2026-10-31', ...row.slice(1)])), /noviembre/);
  assert.match(app.registrarCierreOperaciones(JSON.stringify(row)), /registrado/);
  sheets = [{properties:{title:'OPS_CIERRES', sheetId:24}}];
  app.pccWipValores_ = () => [header,row];
  assert.match(app.registrarCierreOperaciones(JSON.stringify(row)), /ya está registrado/);
  assert.equal(writes, 1);
});

test('conserva el error original cuando falla también el registro de estado', () => {
  const app = context({Logger: {log() {}}});
  app.pccWipSincronizar_ = () => { throw new Error('causa original'); };
  app.pccWipEstado_ = () => { throw new Error('estado agotado'); };
  assert.throws(() => app.sincronizarCostosWip_({}), /causa original/);
});

test('usa la API de Sheets y comunica errores HTTP sin ocultarlos', () => {
  const calls = [];
  const app = context({
    KPI_SPREADSHEET_ID: 'book',
    ScriptApp: {getOAuthToken: () => 'token'},
    UrlFetchApp: {fetch: (url, options) => {
      calls.push([url, options]);
      return {getResponseCode: () => 503, getContentText: () => 'servicio ocupado'};
    }},
  });
  assert.throws(() => app.pccWipEscribir_('CONTROL_WIP!B3', [['VALIDANDO']]), /HTTP 503.*servicio ocupado/);
  assert.match(calls[0][0], /\/values\/CONTROL_WIP!B3\?valueInputOption=RAW$/);
  assert.equal(calls[0][1].method, 'put');
});
