/* Public retail-price tiers from the Costos sheet. The inventory ERP price is a cost. */
(function(root){
'use strict';
function day(value){
 if(value instanceof Date&&!isNaN(value))return value.toISOString().slice(0,10);
 if(typeof value==='number'&&value>40000)return new Date((value-25569)*86400000).toISOString().slice(0,10);
 const s=String(value??'').trim();
 if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null;
}
function company(value){return /TEX/i.test(String(value||''))?'TEX':'EU';}
function key(companyName,ref){return company(companyName)+'|'+String(ref??'').trim();}
function price(value){
 if(value===null||value===undefined||value==='')return null;
 const raw=String(value).trim();
 const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):/^\d{1,3}(\.\d{3})+$/.test(raw)?raw.replace(/\./g,''):raw;
 const n=typeof value==='number'?value:Number(normalized);
 return Number.isFinite(n)&&n>0?n:null;
}
function select(records,cutoff){
 const out=new Map();
 for(const r of records){
  const ref=String(r.ref??'').trim(),date=day(r.costedAt),value=price(r.price);
  if(!ref||!date||date>cutoff)continue;
  const id=key(r.company,ref),prev=out.get(id);
  if(!prev||date>prev.costedAt)out.set(id,{price:value,costedAt:date,conflict:false});
  else if(date===prev.costedAt&&value!==prev.price)out.set(id,{price:null,costedAt:date,conflict:true});
 }
 return out;
}
const api={day,company,key,price,select};
root.PccRetailPrice=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
