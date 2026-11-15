(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PccWipCostGroups = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function lotCost(lot, costs) {
    const empresa = String(lot.empresa || '').trim().toUpperCase();
    const op = String(lot.ordenCorte || '').trim().toUpperCase();
    return empresa && op ? costs.get(empresa + '|' + op) : undefined;
  }

  function groupCosts(lots, costs, groupOf) {
    const byOp = new Map();
    for (const lot of lots) {
      const op = String(lot.ordenCorte || '').trim().toUpperCase();
      if (!op) continue;
      const key = String(lot.empresa || '').trim().toUpperCase() + '|' + op;
      const group = groupOf(lot);
      const units = Number(lot.cant) || 0;
      if (units <= 0) continue;
      if (!byOp.has(key)) byOp.set(key, new Map());
      const groups = byOp.get(key);
      groups.set(group, (groups.get(group) || 0) + units);
    }

    const result = new Map();
    for (const [key, groups] of byOp) {
      const cost = costs.get(key);
      const totalUnits = [...groups.values()].reduce((sum, units) => sum + units, 0);
      for (const [group, units] of groups) {
        if (!result.has(group)) result.set(group, {total: 0, withCost: 0, ops: 0});
        const item = result.get(group);
        item.ops++;
        if (cost) {
          item.withCost++;
          // Una OP que figure en varios grupos reparte su costo por unidades.
          item.total += cost.total * units / totalUnits;
        }
      }
    }
    return result;
  }

  return {groupCosts, lotCost};
});
