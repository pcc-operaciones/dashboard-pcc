// Local comparison only. Source responses stay in ignored .review/, never in Git.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const baseline = 'baseline/pre-v2-2026-09-14';
const cache = path.join(root, '.review', 'sources');
fs.mkdirSync(cache, {recursive:true});
const files = ['index.html','inventario_pt.html','config.json','data-quality.js','data-quality.css','source-freshness.js','source-freshness.css','executive-model.js','executive-adapter.js','executive.js','executive.css'];
const before = Object.fromEntries(files.slice(0,3).map(f=>[f,execFileSync('git',['show',`${baseline}:${f}`],{cwd:root,encoding:'utf8',maxBuffer:2000000})]));
const originals = before['index.html'] + before['inventario_pt.html'] + before['config.json'];
const key = originals.match(/AIza[\w-]+/)[0];
const allowed = new Set(originals.match(/[A-Za-z0-9_-]{30,}/g));
const pending = new Map();
const inject = `<script>window.PCC_REVIEW=true;const realFetch=window.fetch.bind(window);window.fetch=(input,opts)=>{const u=new URL(typeof input==='string'?input:input.url,location.href);return realFetch(u.hostname==='sheets.googleapis.com'?'/__sheets?path='+encodeURIComponent(u.pathname):input,opts);};</script>`;
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4173');
    if(url.pathname==='/__sheets'){
      const p=url.searchParams.get('path')||'';
      const match=p.match(/^\/v4\/spreadsheets\/([\w-]+)\/values\/[^/]+$/);
      if(!match||!allowed.has(match[1])){res.writeHead(403);return res.end('Unsupported source');}
      const file=path.join(cache,crypto.createHash('sha256').update(p).digest('hex')+'.json');
      if(!fs.existsSync(file)){
        if(!pending.has(p))pending.set(p,(async()=>{
          const upstream=await fetch('https://sheets.googleapis.com'+p+'?key='+key,{signal:AbortSignal.timeout(20000)});
          const text=await upstream.text();
          fs.writeFileSync(file,JSON.stringify({path:p,status:upstream.status,capturedAt:new Date().toISOString(),body:text}));
        })().finally(()=>pending.delete(p)));
        await pending.get(p);
      }
      const saved=JSON.parse(fs.readFileSync(file,'utf8'));
      res.writeHead(saved.status,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(saved.body);
    }
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>Revisión Dashboard PCC</h1><p><a href="/before/">Antes</a> · <a href="/after/">Versión nueva</a></p><p>Fuentes capturadas localmente; no es producción.</p>');}
    const m=url.pathname.match(/^\/(before|after)\/(.*)$/);
    const file=m&&(m[2]||'index.html');
    if(!m||!files.includes(file)){res.writeHead(404);return res.end('Not found');}
    let body=m[1]==='before'?before[file]:fs.readFileSync(path.join(root,file),'utf8');
    if(body==null){res.writeHead(404);return res.end('Not found');}
    if(file.endsWith('.html'))body=body.replace('<head>','<head>'+inject);
    const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/json';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
  }catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Fuente no disponible durante la revisión'}}));}
}).listen(4173,'127.0.0.1',()=>console.log('Comparación local: http://127.0.0.1:4173/'));
