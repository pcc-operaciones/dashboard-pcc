const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../apps-script/production-wip/PanelCargaWip.gs'), 'utf8');

function load(extra = {}) {
  const items = [], sidebars = [];
  const menu = {addItem(label, fn) { items.push([label, fn]); return this; }, addToUi() { return this; }};
  const ui = {createMenu(name) { items.push(['menu', name]); return menu; }, showSidebar(html) { sidebars.push(html); }};
  const ctx = {
    Date, String, Math, Error,
    SpreadsheetApp: {getUi: () => ui, openById: () => ({})},
    HtmlService: {createHtmlOutput: html => ({html, setTitle() {return this;}, setWidth() {return this;}})},
    ...extra,
  };
  vm.createContext(ctx);
  new vm.Script(source).runInContext(ctx);
  return {ctx, items, sidebars};
}

test('el menú abre un panel con dos botones y cliente válido', () => {
  const {ctx, items, sidebars} = load();
  ctx.onOpen();
  assert.deepEqual(items, [['menu', 'Carga WIP'], ['Abrir panel de carga', 'abrirPanelCargaWip']]);
  ctx.abrirPanelCargaWip();
  assert.equal(sidebars.length, 1);
  const html = sidebars[0].html;
  assert.match(html, /Procesar los cuatro Excel/);
  assert.match(html, /Consultar estado/);
  const client = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(client);
  assert.ok(client.indexOf("await ejecutar('sincronizarDatos')") < client.indexOf("await ejecutar('calcularKPIs')"));
});

test('guarda una fecha única en CONTROL_WIP y rechaza fechas futuras', () => {
  const written = [];
  const {ctx} = load({
    KPI_SPREADSHEET_ID:'book',
    Utilities:{formatDate:()=>'2026-11-14'},
    pccWipFecha_:value=>value,
    pccWipEscribir_:(range, values) => written.push([range, values]),
    PCC_WIP_CONTROL:'CONTROL_WIP',
  });
  assert.equal(ctx.guardarFechaPanelWip('2026-11-13'), '2026-11-13');
  assert.equal(written[0][0], 'CONTROL_WIP!A2:B3');
  assert.equal(written[0][1][0][1], '2026-11-13');
  assert.throws(() => ctx.guardarFechaPanelWip('2026-11-15'), /futura/);
});
