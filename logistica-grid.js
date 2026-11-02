(function(root){'use strict';
  let openPanel=null;
  const label=value=>String(value??'');
  const parseAmount=value=>{
    const raw=String(value||'').trim().replace(/\./g,'').replace(',','.');
    return raw===''?null:Number(raw);
  };
  function create(tableId,columns,onChange,{sortable=true}={}){
    const table=document.getElementById(tableId),headers=[...table.querySelectorAll('thead th')];
    if(!table||headers.length!==columns.length)throw Error('Columnas de tabla inválidas: '+tableId);
    let source=[],filters=new Map(),sort=null;
    function refreshHeaders(){
      headers.forEach((th,index)=>th.querySelector('button')?.classList.toggle('active',filters.has(index)||sort?.index===index));
    }
    function close(){if(openPanel){openPanel.remove();openPanel=null}}
    function open(index,button){
      close();const col=columns[index],current=filters.get(index)||{},panel=document.createElement('div');
      panel.className='log-col-panel';panel.setAttribute('role','dialog');
      panel.setAttribute('aria-label','Filtrar '+col.label);
      const title=document.createElement('strong');title.textContent=col.label;panel.append(title);
      if(sortable){
        const order=document.createElement('div');order.className='log-col-orders';
        for(const [direction,text] of [['asc','↑ Ascendente'],['desc','↓ Descendente']]){
          const b=document.createElement('button');b.type='button';b.textContent=text;
          b.addEventListener('click',()=>{sort={index,direction};close();refreshHeaders();onChange()});order.append(b);
        }panel.append(order);
      }
      let readFilter;
      if(col.type==='number'){
        const wrap=document.createElement('div');wrap.className='log-col-range';
        const minimum=document.createElement('input'),maximum=document.createElement('input');
        minimum.type=maximum.type='text';minimum.inputMode=maximum.inputMode='decimal';
        minimum.placeholder='Mínimo';maximum.placeholder='Máximo';
        minimum.value=current.minText||'';maximum.value=current.maxText||'';
        wrap.append(minimum,maximum);panel.append(wrap);
        readFilter=()=>({minText:minimum.value,maxText:maximum.value,
          min:parseAmount(minimum.value),max:parseAmount(maximum.value)});
      }else if(col.type==='enum'){
        const values=[...new Set(source.map(row=>label(col.get(row))))].sort((a,b)=>a.localeCompare(b,'es'));
        const wrap=document.createElement('div');wrap.className='log-col-values';
        for(const value of values){
          const item=document.createElement('label'),input=document.createElement('input');
          input.type='checkbox';input.value=value;input.checked=!current.selected||current.selected.includes(value);
          item.append(input,document.createTextNode(value||'Sin dato'));wrap.append(item);
        }panel.append(wrap);
        readFilter=()=>({selected:[...wrap.querySelectorAll('input:checked')].map(input=>input.value)});
      }else{
        const input=document.createElement('input');input.type='search';input.placeholder='Contiene…';
        input.value=current.query||'';panel.append(input);
        readFilter=()=>({query:input.value.trim().toLocaleLowerCase('es')});
      }
      const actions=document.createElement('div');actions.className='log-col-actions';
      const apply=document.createElement('button');apply.type='button';apply.textContent='Aplicar';
      apply.addEventListener('click',()=>{
        const value=readFilter();
        const empty=col.type==='number'?value.min===null&&value.max===null:
          col.type==='enum'?value.selected.length===source.length||value.selected.length===
            new Set(source.map(row=>label(col.get(row)))).size:!value.query;
        if(empty)filters.delete(index);else filters.set(index,value);
        close();refreshHeaders();onChange();
      });
      const clear=document.createElement('button');clear.type='button';clear.textContent='Limpiar';
      clear.addEventListener('click',()=>{filters.delete(index);if(sort?.index===index)sort=null;close();refreshHeaders();onChange()});
      actions.append(clear,apply);panel.append(actions);document.body.append(panel);openPanel=panel;
      const rect=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-268))+'px';
      panel.style.top=Math.max(8,Math.min(rect.bottom+4,innerHeight-panel.offsetHeight-8))+'px';
    }
    headers.forEach((th,index)=>{
      const button=document.createElement('button');button.type='button';button.className='log-col-button';
      button.setAttribute('aria-label','Filtrar '+columns[index].label);
      button.append(document.createTextNode(columns[index].label));
      const arrow=document.createElement('span');arrow.textContent='▾';button.append(arrow);
      th.replaceChildren(button);button.addEventListener('click',event=>{event.stopPropagation();open(index,button)});
    });
    function apply(rows){
      source=rows;refreshHeaders();
      const filtered=rows.filter(row=>[...filters].every(([index,rule])=>{
        const col=columns[index],value=col.get(row);
        if(col.type==='number'){
          if(value===null||value===undefined||value==='')return false;
          const amount=Number(value);return Number.isFinite(amount)&&
            (rule.min===null||amount>=rule.min)&&(rule.max===null||amount<=rule.max);
        }
        if(col.type==='enum')return rule.selected.includes(label(value));
        return label(value).toLocaleLowerCase('es').includes(rule.query);
      }));
      if(sort){const col=columns[sort.index],direction=sort.direction==='asc'?1:-1;
        filtered.sort((a,b)=>{
          const left=col.get(a),right=col.get(b);
          if(left==null||left==='')return right==null||right===''?0:1;
          if(right==null||right==='')return -1;
          return direction*(col.type==='number'?Number(left)-Number(right):
            label(left).localeCompare(label(right),'es'));
        });
      }
      return filtered;
    }
    function clearAll(){filters.clear();sort=null;close();refreshHeaders();onChange()}
    return {apply,clearAll};
  }
  document.addEventListener('pointerdown',event=>{
    if(openPanel&&!openPanel.contains(event.target)&&!event.target.closest('.log-col-button')){
      openPanel.remove();openPanel=null;
    }
  });
  root.PccLogisticsGrid={create};
})(window);
