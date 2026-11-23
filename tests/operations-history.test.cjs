const {test} = require('node:test');
const assert = require('node:assert/strict');
const history = require('../operations-history-model.js');
const {ops} = require('../data-quality.js');

const opsHeader = ['FECHA_CORTE','EFICIENCIA','RENTABILIDAD','CUMPLIMIENTO','UNIDADES_CALIDAD','UNIDADES_NO_CONFORMES','MODULOS_CON_DATOS','MODULOS_CONFIGURADOS'];
const wipHeader = ['FECHA_CORTE','UNIDADES_WIP','VALOR_CONOCIDO_COP','OP_ACTIVAS','OP_CON_COSTO'];

test('noviembre es el primer mes elegible al terminar el 30 en Colombia', () => {
  const config = {mes:'Noviembre', año:'2026'};
  assert.equal(history.eligibleCutoff({mes:'Octubre', año:2026}, new Date('2026-11-23T12:00Z')), '');
  assert.equal(history.eligibleCutoff(config, new Date('2026-12-01T04:59Z')), '');
  assert.equal(history.eligibleCutoff(config, new Date('2026-12-01T05:00Z')), '2026-11-30');
  assert.equal(history.eligibleCutoff({mes:'Diciembre', año:2026}, new Date('2027-01-02T12:00Z')), '2026-12-31');
});

test('congela los indicadores operativos con las fórmulas del tablero y calidad del mes', () => {
  const quality = [['O.P. número', 'CANTIDAD OP', 'NO CONFORMES COSTURA', 'FF PRESENTACIÓN'],
    ['OP-1', 20, 2, '30/11/2026'], ['OP-2', 80, 0, '2026-11-03'], ['OP-3', 400, '', '2026-11-04'],
    ['OP-4', 20, 10, '31/11/2026'], ['OP-5', 500, 100, '2026-10-31']];
  const data = history.qualityForMonth(quality, '2026-11');
  const daily = [{dia:30, pro:10, real:80, teo:100, um:20, ing:100, cos:110}, {dia:31, pro:100, real:300, teo:100, um:20, ing:100, cos:0}];
  assert.deepEqual(history.snapshot('2026-11-30', [{pk:'EU', daily}], 2, data, ops), ['2026-11-30', 0.8, -0.1, 0.5, 100, 2, 1, 2]);
});

test('solo publica nuevos cierres registrados y cruza WIP del mismo fin de mes', () => {
  const registered = history.readOps([opsHeader, ['2026-10-31', 0.8, 0, 0.5, 100, 2, 1, 2],
    ['2026-11-30', 0.8, -0.1, 0.5, 100, 2, 1, 2], ['2026-12-31', 0.8, 0.1, 0.5, '', '', 1, 2]]);
  const wip = history.readWip([wipHeader, ['2026-11-30', 100, '', 2, 0], ['2027-01-31', 30, 100, 2, 2]]);
  assert.deepEqual(history.compile(registered, wip, '2026-11').map(row => [row.key,row.wip?.units,row.wip?.value]), [['2026-11',100,null]]);
  assert.deepEqual(history.compile(registered, wip, '2027-02').map(row => [row.key,row.wip?.units]), [['2026-12',undefined],['2026-11',100]]);
  assert.throws(() => history.readWip([wipHeader, ['2026-11-12', 10, 100, 1, 1]]), /inválida/);
});
