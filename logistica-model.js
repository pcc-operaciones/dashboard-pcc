(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.PccLogisticsModel=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const TYPES={CPN:'Consumo de producción',EAC:'Entrada por compras',DCN:'Devolución de consumos de producción',RM:'Remisión de salida',DCP:'Devolución en compras',AIC:'Ajuste de inventarios cíclico',EIV:'Entradas de inventario directas',ENS:'Procesos de ensamble'};
  const WAREHOUSES={MT001:'Telas',MT002:'Insumos'};
  const number=v=>Number.isFinite(Number(v))?Number(v):0;
  const materialType=warehouse=>WAREHOUSES[warehouse]||'Sin clasificar';
  const key=r=>[r.company,r.warehouse,r.ref,r.unit].join('\u001f');
  function matchScope(row,scope){
    if(scope.company!=='all'&&row.company!==scope.company)return false;
    if(scope.type!=='all'&&materialType(row.warehouse)!==scope.type)return false;
    if(scope.warehouse!=='all'&&row.warehouse!==scope.warehouse)return false;
    return true;
  }
  function stockSummary(rows){
    const quantity={},committed={},available={};let value=0,zeroCost=0,committedPositions=0;
    for(const r of rows){
      value+=number(r.costTotal);
      quantity[r.unit]=(quantity[r.unit]||0)+number(r.physical);
      committed[r.unit]=(committed[r.unit]||0)+number(r.committed);
      available[r.unit]=(available[r.unit]||0)+number(r.available);
      if(number(r.physical)>0&&number(r.costTotal)===0)zeroCost++;
      if(number(r.committed)>0)committedPositions++;
    }
    return {positions:rows.length,value,quantity,committed,available,zeroCost,committedPositions};
  }
  function movementRows(rows,scope,fromDate,toDate){
    return rows.filter(r=>matchScope(r,scope)&&(!fromDate||r.date>=fromDate)&&(!toDate||r.date<=toDate));
  }
  function movementSummary(rows,unit){
    const codes={};let inRows=0,outRows=0;let inCost=0,outCost=0,inQty=0,outQty=0;const dates=[];
    for(const r of rows){
      const code=r.docType||'Sin tipo';
      const s=codes[code]||(codes[code]={rows:0,inRows:0,outRows:0,inQty:0,outQty:0,inCost:0,outCost:0});
      s.rows++;
      if(number(r.inQty)>0){s.inRows++;inRows++}
      if(number(r.outQty)>0){s.outRows++;outRows++}
      if(!unit||r.unit===unit){s.inQty+=number(r.inQty);s.outQty+=number(r.outQty);
        inQty+=number(r.inQty);outQty+=number(r.outQty)}
      s.inCost+=number(r.inCost);s.outCost+=number(r.outCost);
      inCost+=number(r.inCost);outCost+=number(r.outCost);
      if(r.date)dates.push(r.date);
    }
    dates.sort();
    return {rows:rows.length,codes,inRows,outRows,inQty,outQty,inCost,outCost,firstDate:dates[0]||null,lastDate:dates[dates.length-1]||null};
  }
  function monthlyMovements(rows,from,to,unit){
    const months=new Map();
    for(const r of rows){
      if(r.date<from||r.date>to)continue;
      const month=r.date.slice(0,7),item=months.get(month)||{month,rows:0,inQty:0,outQty:0,inCost:0,outCost:0};
      item.rows++;
      if(!unit||r.unit===unit){item.inQty+=number(r.inQty);item.outQty+=number(r.outQty)}
      item.inCost+=number(r.inCost);item.outCost+=number(r.outCost);
      months.set(month,item);
    }
    const result=[];
    for(let current=from.slice(0,7);current<=to.slice(0,7);){
      const first=current+'-01',last=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(5,7)),0)).toISOString().slice(0,10);
      const observedFrom=first<from?from:first,observedTo=last>to?to:last;
      result.push({month:current,rows:0,inQty:0,outQty:0,inCost:0,outCost:0,...months.get(current),
        from:observedFrom,to:observedTo,partial:observedFrom!==first||observedTo!==last});
      const next=new Date(Date.UTC(Number(current.slice(0,4)),Number(current.slice(5,7)),1));
      current=next.toISOString().slice(0,7);
    }
    return result;
  }
  function production(rows,unit){
    const groups=new Map();
    for(const r of rows){
      if(r.docType!=='CPN'&&r.docType!=='DCN')continue;
      if(unit&&r.unit!==unit)continue;
      const k=key(r);let item=groups.get(k);
      if(!item){item={company:r.company,warehouse:r.warehouse,ref:r.ref,name:r.name,unit:r.unit,gross:0,returns:0,net:0,grossCost:0,returnCost:0,netCost:0};groups.set(k,item)}
      if(r.docType==='CPN'){item.gross+=number(r.outQty);item.grossCost+=number(r.outCost)}
      else{item.returns+=number(r.inQty);item.returnCost+=number(r.inCost)}
    }
    for(const item of groups.values()){item.net=item.gross-item.returns;item.netCost=item.grossCost-item.returnCost}
    return [...groups.values()].sort((a,b)=>b.net-a.net||a.ref.localeCompare(b.ref));
  }
  function quantityByUnit(rows,field){const out={};for(const r of rows)out[r.unit]=(out[r.unit]||0)+number(r[field]);return out}
  function periodDays(from,to){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||''))return null;
    const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
    return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.round((end-start)/86400000)+1:null;
  }
  function coverage(stock,moves,from,to){
    const days=periodDays(from,to),consumption=new Map();
    for(const r of moves){
      if(r.date<from||r.date>to)continue;
      const k=key(r),item=consumption.get(k)||{gross:0,returns:0};
      if(r.docType==='CPN')item.gross+=number(r.outQty);
      if(r.docType==='DCN')item.returns+=number(r.inQty);
      consumption.set(k,item);
    }
    const positions=new Map();
    for(const r of stock){
      const k=key(r),item=positions.get(k);
      if(item){item.physical+=number(r.physical);item.costTotal+=number(r.costTotal)}
      else positions.set(k,{...r,physical:number(r.physical),costTotal:number(r.costTotal)});
    }
    return [...positions.values()].map(r=>{
      const flow=consumption.get(key(r))||{gross:0,returns:0};
      const net=flow.gross-flow.returns;
      const coverageDays=days&&net>0&&number(r.physical)>0?number(r.physical)/(net/days):null;
      const category=!days?'Sin período':number(r.physical)<=0?'Sin existencia':net<=0?'Sin consumo neto en período':
        coverageDays<40.5?'Bajo 40,5 d':coverageDays<=49.5?'En meta':'Sobre 49,5 d';
      return {...r,consumption:net,coverageDays,coverageCategory:category,periodDays:days};
    });
  }
  function daysAndRotation(stock,moves,from,to,warehouse,unit){
    const days=periodDays(from,to);
    const physical=stock.filter(r=>r.warehouse===warehouse&&r.unit===unit)
      .reduce((sum,r)=>sum+number(r.physical),0);
    const flow=moves.filter(r=>r.warehouse===warehouse&&r.unit===unit&&r.date>=from&&r.date<=to)
      .reduce((sum,r)=>sum+(r.docType==='CPN'?number(r.outQty):0)-
        (r.docType==='DCN'?number(r.inQty):0),0);
    return {physical,consumption:flow,periodDays:days,
      daysOfInventory:days&&physical>0&&flow>0?physical/(flow/days):null,
      annualizedRotation:days&&physical>0&&flow>0?(flow/physical)*(365/days):null};
  }
  function monthlyConsumption(moves,from,to,warehouse,unit){
    const months=new Map();
    for(const r of moves){
      if(r.warehouse!==warehouse||r.unit!==unit||r.date<from||r.date>to||
        (r.docType!=='CPN'&&r.docType!=='DCN'))continue;
      const month=r.date.slice(0,7);
      months.set(month,(months.get(month)||0)+(r.docType==='CPN'?number(r.outQty):-number(r.inQty)));
    }
    return [...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,consumption])=>({month,consumption}));
  }
  function consumptionAge(stock,moves,from,to){
    const days=periodDays(from,to),last=new Map();
    for(const r of moves){
      if(r.docType!=='CPN'||number(r.outQty)<=0||r.date<from||r.date>to)continue;
      const k=key(r),previous=last.get(k);
      if(!previous||r.date>previous)last.set(k,r.date);
    }
    const grouped=new Map();
    for(const r of stock){
      const k=key(r),item=grouped.get(k);
      if(item){item.physical+=number(r.physical);item.costTotal+=number(r.costTotal)}
      else grouped.set(k,{...r,physical:number(r.physical),costTotal:number(r.costTotal)});
    }
    return [...grouped.values()].filter(r=>r.physical>0).map(r=>{
      const lastDate=last.get(key(r))||null;
      const elapsed=lastDate?periodDays(lastDate,to)-1:null;
      const category=lastDate?(elapsed<=30?'0–30 días':elapsed<=60?'31–60 días':elapsed<=90?'61–90 días':'+90 días'):
        days>=90?'Sin CPN en 90 días':'Sin CPN en rango';
      return {...r,lastConsumption:lastDate,daysSinceConsumption:elapsed,consumptionCategory:category};
    });
  }
  return {TYPES,WAREHOUSES,materialType,matchScope,stockSummary,movementRows,movementSummary,monthlyMovements,
    production,quantityByUnit,periodDays,coverage,daysAndRotation,monthlyConsumption,consumptionAge};
});
