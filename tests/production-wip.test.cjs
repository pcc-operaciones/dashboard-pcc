const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../apps-script/production-wip/CostosWip.gs'), 'utf8');
const header = ['O.P. Número', 'ESTADO OP:', 'Real acum. MP', 'Real acum. MO', 'Real acum. CIF', 'Real acum.'];

function context(overrides = {}) {
  const sandbox = {
    Date, JSON, String, Number, Object, Array, Math, Error, isFinite,
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
