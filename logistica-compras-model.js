(function(root,factory){
  const model=factory();
  if(typeof module==='object'&&module.exports)module.exports=model;
  else root.PccLogisticsPurchasesModel=model;
})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
  const HEADER=['empresa','fecha','tipo_documento','documento','factura_referencia',
    'causacion','comprador','proveedor','bodega','referencia','descripcion',
    'unidad','cantidad','precio_unitario','valor_bruto'];
  const s=v=>String(v??'').trim();
  const n=v=>{const x=Number(v);if(!Number.isFinite(x))throw Error('Número inválido en compras');return x};
  const display=v=>s(v).replace(/\s+/g,' ');
  const identity=v=>display(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  function parse(grid){
    if(grid[0]?.join('|')!==HEADER.join('|'))throw Error('Esquema de compras inesperado');
    return grid.slice(1).filter(r=>r[0]).map(r=>{
      const x={company:s(r[0]),date:s(r[1]),kind:s(r[2]),document:s(r[3]),
        invoice:s(r[4]),causation:s(r[5]),buyer:s(r[6]),supplier:s(r[7]),
        warehouse:s(r[8]),ref:s(r[9]),name:s(r[10]),unit:s(r[11]),
        qty:n(r[12]),price:n(r[13]),value:n(r[14])};
      if(!['EU','TEX'].includes(x.company)||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||
         !['EAC','DCP'].includes(x.kind)||x.warehouse!=='MT001'||
         !x.ref||!x.buyer||!x.supplier||!x.unit||
         Math.abs(x.qty*x.price-x.value)>Math.max(1,Math.abs(x.value)*0.00001))
        throw Error('Línea de compras inválida: '+x.company+' '+x.ref);
      return x;
    });
  }
  function select(rows,{company='all',from='',to='',buyer='all',supplier='all'}={}){
    return rows.filter(r=>(company==='all'||r.company===company)&&
      (!from||r.date>=from)&&(!to||r.date<=to)&&
      (buyer==='all'||identity(r.buyer)===buyer)&&
      (supplier==='all'||identity(r.supplier)===supplier));
  }
  function summary(rows,unit){
    const eac=rows.filter(r=>r.kind==='EAC'),dcp=rows.filter(r=>r.kind==='DCP');
    const sum=(list,key)=>list.reduce((a,r)=>a+r[key],0);
    return {lines:rows.length,receipts:eac.length,returns:dcp.length,
      receiptValue:sum(eac,'value'),returnValue:sum(dcp,'value'),netValue:sum(rows,'value'),
      receiptQty:sum(eac.filter(r=>r.unit===unit),'qty'),
      returnQty:sum(dcp.filter(r=>r.unit===unit),'qty'),
      buyers:new Set(rows.map(r=>identity(r.buyer))).size,
      suppliers:new Set(rows.map(r=>identity(r.supplier))).size};
  }
  function ranking(rows,key,combine=false){
    const map=new Map();
    for(const r of rows){
      const name=display(r[key]),id=[combine?'EU+TEX':r.company,identity(name)].join('|');
      let item=map.get(id);
      if(!item){item={company:combine?'EU+TEX':r.company,name,identity:identity(name),
        lines:0,value:0,quantity:0,receipts:0,returns:0};map.set(id,item)}
      item.lines++;item.value+=r.value;item.quantity+=r.qty;
      if(r.kind==='EAC')item.receipts++;else item.returns++;
    }
    return [...map.values()].sort((a,b)=>b.value-a.value||a.company.localeCompare(b.company)||a.name.localeCompare(b.name));
  }
  function monthly(rows,combine=false){
    const map=new Map();
    for(const r of rows){
      const company=combine?'EU+TEX':r.company;
      const id=r.date.slice(0,7)+'|'+company;
      let item=map.get(id);
      if(!item){item={month:r.date.slice(0,7),company,receipts:0,returns:0,net:0,
        receiptQty:0,returnQty:0,netQty:0};map.set(id,item)}
      item.net+=r.value;item.netQty+=r.qty;
      if(r.kind==='EAC'){item.receipts+=r.value;item.receiptQty+=r.qty}
      else{item.returns+=r.value;item.returnQty+=r.qty}
    }
    return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)||a.company.localeCompare(b.company));
  }
  function priceChanges(rows){
    const groups=new Map();
    for(const r of rows){
      if(r.kind!=='EAC'||r.qty<=0)continue;
      const key=[r.company,r.ref,r.unit,r.supplier].join('|');
      let g=groups.get(key);
      if(!g){g={company:r.company,ref:r.ref,name:r.name,unit:r.unit,supplier:r.supplier,dates:new Map()};groups.set(key,g)}
      let day=g.dates.get(r.date);
      if(!day){day={date:r.date,qty:0,value:0};g.dates.set(r.date,day)}
      day.qty+=r.qty;day.value+=r.value;
    }
    const out=[];
    for(const g of groups.values()){
      const days=[...g.dates.values()].sort((a,b)=>a.date.localeCompare(b.date));
      if(days.length<2)continue;
      const first=days[0],last=days[days.length-1];
      const initial=first.value/first.qty,final=last.value/last.qty;
      out.push({company:g.company,ref:g.ref,name:g.name,unit:g.unit,supplier:g.supplier,
        firstDate:first.date,lastDate:last.date,initial,final,
        difference:final-initial,percent:initial>0?(final/initial-1)*100:null,observations:days.length});
    }
    return out.sort((a,b)=>Math.abs(b.percent??0)-Math.abs(a.percent??0)||a.ref.localeCompare(b.ref));
  }
  function stockLinks(stock,allPurchases,cut,company='all'){
    const byRef=new Map();
    for(const p of allPurchases){
      if(p.date>cut||p.kind!=='EAC')continue;
      const key=[p.company,p.warehouse,p.ref,p.unit].join('|');
      let x=byRef.get(key);
      if(!x){x={buyers:new Map(),latest:''};byRef.set(key,x)}
      x.buyers.set(identity(p.buyer),display(p.buyer));if(p.date>x.latest)x.latest=p.date;
    }
    return stock.filter(r=>r.warehouse==='MT001'&&r.physical>0&&
      (company==='all'||r.company===company)).map(r=>{
      const x=byRef.get([r.company,r.warehouse,r.ref,r.unit].join('|'));
      const buyers=x?[...x.buyers.values()].sort():[];
      return {company:r.company,warehouse:r.warehouse,ref:r.ref,name:r.name,unit:r.unit,
        physical:r.physical,value:r.costTotal,buyers,latest:x?.latest||'',
        status:buyers.length===0?'Sin compra observada':buyers.length===1?'Un comprador observado':'Varios compradores'};
    });
  }
  function buyerConsumption(purchases,movements,from,to,company,unit){
    const candidates=new Map(),names=new Map();
    for(const p of purchases){
      if(p.kind!=='EAC'||p.date>to||p.warehouse!=='MT001'||p.unit!==unit||
         (company!=='all'&&p.company!==company))continue;
      const buyer=identity(p.buyer),key=[p.company,p.warehouse,p.ref,p.unit].join('|');
      if(!candidates.has(key))candidates.set(key,[]);
      candidates.get(key).push({date:p.date,buyer});names.set(buyer,display(p.buyer));
    }
    const groups=new Map();
    const get=(key)=>{
      if(!groups.has(key))groups.set(key,{identity:key,name:names.get(key)||'Sin atribuir',
        purchased:0,consumed:0,purchasedValue:0,consumedValue:0,
        purchaseRows:[],movementRows:[]});
      return groups.get(key);
    };
    for(const p of purchases){
      if(p.date<from||p.date>to||p.warehouse!=='MT001'||p.unit!==unit||
         (company!=='all'&&p.company!==company))continue;
      const g=get(identity(p.buyer));g.purchased+=p.qty;g.purchasedValue+=p.value;
      g.purchaseRows.push(p);
    }
    for(const r of movements){
      if(r.date<from||r.date>to||r.warehouse!=='MT001'||r.unit!==unit||
         (company!=='all'&&r.company!==company)||
         (r.docType!=='CPN'&&r.docType!=='DCN'))continue;
      const history=candidates.get([r.company,r.warehouse,r.ref,r.unit].join('|'))||[];
      const buyers=new Set(history.filter(p=>p.date<=r.date).map(p=>p.buyer));
      const key=buyers.size===1?[...buyers][0]:'__SIN_ATRIBUIR__';
      const g=get(key);g.consumed+=r.docType==='CPN'?r.outQty:-r.inQty;
      g.consumedValue+=r.docType==='CPN'?r.outCost:-r.inCost;
      g.movementRows.push(r);
    }
    const rows=[...groups.values()].sort((a,b)=>b.purchased-a.purchased||
      b.consumed-a.consumed||a.name.localeCompare(b.name));
    return {rows,purchased:rows.reduce((a,r)=>a+r.purchased,0),
      consumed:rows.reduce((a,r)=>a+r.consumed,0),
      unattributed:groups.get('__SIN_ATRIBUIR__')?.consumed||0};
  }
  return {HEADER,parse,select,summary,ranking,monthly,priceChanges,stockLinks,
    buyerConsumption,identity,display};
});
