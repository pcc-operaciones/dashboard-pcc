const test = require('node:test');
const assert = require('node:assert/strict');
const {groupCosts, lotCost} = require('../wip-cost-groups.js');

test('el modal cruza por empresa y OP sin confundir órdenes iguales', () => {
  const costs = new Map([
    ['EU|OP-1', {total:100, mp:60, mo:30, cif:10}],
    ['TEX|OP-1', {total:200, mp:120, mo:60, cif:20}],
  ]);
  assert.equal(lotCost({empresa:' tex ', ordenCorte:' op-1 '}, costs).total, 200);
  assert.equal(lotCost({empresa:'EU', ordenCorte:'OP-2'}, costs), undefined);
});

test('agrupa costo por empresa y OP, sin duplicar lotes de la misma orden', () => {
  const lots = [
    {empresa:'EU', ordenCorte:'OP-1', estado:'CORTE', cant:60},
    {empresa:'EU', ordenCorte:'OP-1', estado:'CORTE', cant:40},
    {empresa:'TEX', ordenCorte:'OP-1', estado:'CORTE', cant:50},
    {empresa:'EU', ordenCorte:'OP-2', estado:'CORTE', cant:20},
  ];
  const costs = new Map([
    ['EU|OP-1', {total:1000}],
    ['TEX|OP-1', {total:2000}],
  ]);
  const grouped = groupCosts(lots, costs, lot => lot.estado);
  assert.deepEqual(grouped.get('CORTE'), {total:3000, withCost:2, ops:3});
});

test('reparte una OP entre estados o líneas por unidades y reconcilia el total', () => {
  const lots = [
    {empresa:'EU', ordenCorte:'OP-1', estado:'CORTE', linea:'LÍNEA', cant:75},
    {empresa:'EU', ordenCorte:'OP-1', estado:'CONFECCION', linea:'MODA', cant:25},
  ];
  const costs = new Map([['EU|OP-1', {total:400}]]);
  const states = groupCosts(lots, costs, lot => lot.estado);
  const lines = groupCosts(lots, costs, lot => lot.linea);
  assert.equal(states.get('CORTE').total, 300);
  assert.equal(states.get('CONFECCION').total, 100);
  assert.equal(lines.get('LÍNEA').total + lines.get('MODA').total, 400);
});
