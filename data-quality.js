(function(root){
  'use strict';
  const valid=n=>typeof n==='number'&&Number.isFinite(n);
  function period(mov, now=new Date()){
    const keys=[...new Set(mov.map(m=>String(m.fecha||'').slice(0,7)).filter(k=>/^\d{4}-\d{2}$/.test(k)&&+k.slice(5)>=1&&+k.slice(5)<=12&&k<=now.toISOString().slice(0,7)))].sort();
    if(!keys.length)return {days:0,label:'Sin período de movimientos',missing:[]};
    const [y,m]=keys[0].split('-').map(Number),[ey,em]=keys.at(-1).split('-').map(Number);
    const start=Date.UTC(y,m-1,1),end=Math.min(Date.UTC(ey,em,0),Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
    const missing=[];for(let a=y,b=m;a<ey||(a===ey&&b<=em);b++){if(b>12){a++;b=1;}if(a>ey||(a===ey&&b>em))break;const k=a+'-'+String(b).padStart(2,'0');if(!keys.includes(k))missing.push(k);}
    return {days:Math.floor((end-start)/86400000)+1,label:keys[0]+' a '+keys.at(-1),missing};
  }
  function rotation(stock,dispatch,days){return stock>0&&days>0&&valid(dispatch)?dispatch/stock*365/days:null;}
  function coverage(stock,dispatch,days){return dispatch>0&&days>0?stock/(dispatch/days):null;}
  function ops(mods,field){
    let numerator=0,denominator=0;
    for(const m of mods){
      let n=0,dn=0;
      for(const d of m.daily||[]){
        if(field==='ef'&&m.pk!=='SERV'&&(d.pro>0||d.real>0||d.ing>0)){n+=d.real||0;dn+=d.teo||0;}
        if(field==='cumpl'){n+=d.pro||0;dn+=d.um||0;}
        if(field==='util'&&(d.cos>0||d.ing>0)){n+=(d.ing||0)-(d.cos||0);dn+=d.ing||0;}
      }
      if(dn>0){numerator+=n;denominator+=dn;}
    }
    return denominator>0?numerator/denominator:null;
  }
  function tasks(cfg,config){
    const chosen=new Map(),skipped=[];
    for(const [pk,group] of Object.entries(cfg)){
      if(!config?.ids?.[pk] || pk.includes('|')){skipped.push(pk+' (fuente del período sin validar)');continue;}
      for(const [mk,sheet] of Object.entries(group.mods)){
        const key=group.id+'|'+sheet.trim().toUpperCase();
        const task={pk,mk},prev=chosen.get(key);
        if(prev){
          if(config.modulosExtra?.[pk+'|'+mk]){skipped.push(prev.pk+' / '+prev.mk+' (hoja repetida)');chosen.set(key,task);}
          else skipped.push(pk+' / '+mk+' (hoja repetida)');
        }else chosen.set(key,task);
      }
    }
    return {items:[...chosen.values()],skipped};
  }
  const sources=new Map(),notes=new Map();
  const api={period,rotation,coverage,ops,tasks,sources,notes};
  api.note=(key,text)=>{if(text)notes.set(key,text);else notes.delete(key);render();};
  api.load=async(key,fn)=>{
    sources.set(key,{state:'loading'});render();
    try{const rows=await fn();sources.set(key,{state:rows.length?'ok':'empty',at:new Date()});render();return rows;}
    catch(e){sources.set(key,{state:'error',message:e.message});render();throw e;}
  };
  function render(){
    if(!root.document||!document.body)return;
    let box=document.getElementById('pcc-data-quality');
    if(!box){box=document.createElement('details');box.id='pcc-data-quality';box.className='pcc-quality';const anchor=document.getElementById('gerencia-bar')||document.querySelector('.topbar');if(anchor)anchor.after(box);else document.body.prepend(box);}
    const errors=[...sources].filter(([,s])=>s.state==='error'),loading=[...sources].filter(([,s])=>s.state==='loading'),ok=[...sources].filter(([,s])=>s.state==='ok').length;
    box.replaceChildren();
    const summary=document.createElement('summary');
    summary.textContent=(errors.length?'Datos incompletos':loading.length?'Actualizando fuentes':'Estado de las fuentes')+' · '+ok+'/'+sources.size+' con datos'+(notes.size?' · '+notes.size+' observaciones':'');
    box.append(summary);
    const ul=document.createElement('ul');
    for(const [key,s]of sources){const li=document.createElement('li');li.textContent=key+': '+({ok:'consultada',empty:'sin registros',loading:'cargando',error:'no disponible'}[s.state])+(s.at?' · '+s.at.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}):'')+(s.message?' · '+s.message:'');ul.append(li);}
    for(const text of notes.values()){const li=document.createElement('li');li.textContent=text;ul.append(li);}
    box.append(ul);box.classList.toggle('has-error',!!errors.length);
  }
  root.PccData=api;
  if(typeof module!=='undefined')module.exports=api;
  if(root.document)document.addEventListener('DOMContentLoaded',render);
})(typeof window!=='undefined'?window:globalThis);
