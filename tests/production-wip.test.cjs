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

test('mantiene el último corte si solo se reemplaza uno de los Excel', () => {
  const messages = [];
  const props = {eu: 1000, tex: 1000, cutoff: '2026-11-12'};
  const app = context({
    DriveApp: {getFileById: id => ({getLastUpdated: () => new Date(id.includes('16Pev') ? 2000 : 1000)})},
    PropertiesService: {getScriptProperties: () => ({getProperty: () => JSON.stringify(props)})},
    Logger: {log: value => messages.push(value)},
  });
  const cells = {A2: {setValue() {}}, A3: {setValue() {}}, B3: {setValue: value => messages.push(value)}};
  const sheet = {getRange: address => cells[address]};
  const ss = {getSheetByName: () => sheet};
  app.sincronizarCostosWip_(ss);
  assert.ok(messages.some(message => String(message).includes('PENDIENTE')));
});
