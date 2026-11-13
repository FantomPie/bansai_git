import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {gzipSync} from 'node:zlib';
let dir,child,base,admin,logs='';
const id='11111111-1111-4111-8111-111111111111';
const json=Buffer.from('{"asset":{"version":"2.0"}}  ');
const glb=Buffer.alloc(20+json.length);glb.write('glTF');glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(json.length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);
async function freePort(){const server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const p=server.address().port;await new Promise(r=>server.close(r));return p;}
before(async()=>{
 dir=await mkdtemp(join(tmpdir(),'museum-catalog-test-'));await mkdir(join(dir,'models'));await mkdir(join(dir,'evidence'));
 await writeFile(join(dir,'catalog-index.json'),JSON.stringify({objects:[{path:'H1/ARMOR',name:'ARMOR'}]}));
 await writeFile(join(dir,'models',id+'.glb'),glb);await writeFile(join(dir,'models',id+'.glb.gz'),gzipSync(glb));
 await writeFile(join(dir,'models',id+'.json'),JSON.stringify({name:'Test',folder:'H1/ARMOR',size:glb.length,createdAt:new Date().toISOString()}));
 await writeFile(join(dir,'evidence','test.jpg'),Buffer.from([255,216,255,217]));
 const port=await freePort(),ap=await freePort();base='http://127.0.0.1:'+port;admin='http://127.0.0.1:'+ap;
 child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),ADMIN_PORT:String(ap),ENABLE_ADMIN:'true',UPLOAD_TOKEN:'test-only-token',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 let ready=false;for(let n=0;n<100;n++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,logs);
});
after(async()=>{if(child){const exit=once(child,'exit');child.kill();await exit;}if(dir)await rm(dir,{recursive:true,force:true});});
test('health, catalog identity and local viewer assets',async()=>{
 assert.equal((await fetch(base+'/healthz')).status,200);
 const c=await (await fetch(base+'/api/catalog')).json();assert.equal(c.models[0].id,id);assert.equal(c.autoImport.enabled,false);
 assert.equal((await fetch(base+'/vendor/model-viewer.min.js')).status,200);assert.equal((await fetch(base+'/evidence/test.jpg')).status,200);
 assert.match(await (await fetch(base+'/')).text(),/Каталог объектов/);
});
test('armor gallery routes and media manifest are available',async()=>{
 assert.equal((await fetch(base+'/armor/')).status,200);
 const data=await (await fetch(base+'/armor/data.json')).json();assert.equal(data.parts.length,17);
 assert.ok(data.parts.every(p=>p.views.every(v=>v.preview.startsWith('https://github.com/FantomPie/bansai_git/releases/download/'))));
 const comparison=data.parts.find(p=>p.id==='02').comparison;
 assert.deepEqual(comparison.references.map(r=>r.id),['front','left','right','back']);
 assert.ok(comparison.references.every(r=>r.preview.startsWith('https://github.com/FantomPie/bansai_git/releases/download/')&&r.original.endsWith('.jpg')&&r.orbit));
 assert.equal((await fetch(base+'/armor/comparison.js')).status,200);
 assert.equal((await fetch(base+'/armor/comparison.css')).status,200);
});
test('manifest exposes 17 roles and saves a review for its exact version',async()=>{
 const home=await (await fetch(base+'/')).text();
 assert.match(home,/href="\/manifest\/"/);
 assert.equal((await fetch(base+'/manifest/')).status,200);
 assert.equal((await fetch(base+'/manifest/review.js')).status,200);
 const {parts}=await (await fetch(base+'/manifest/data.json')).json();
 assert.equal(parts.length,19);
 assert.equal(new Set(parts.map(part=>part.role)).size,17);
 const [part]=parts;
 assert.ok(parts.every(entry=>entry.views[0].url==='/manifest/model/'+entry.id+'.glb'&&entry.version===entry.modelAsset.sha256));
 assert.equal((await fetch(base+'/manifest/model/UNKNOWN.glb')).status,404);
 const endpoint=base+'/api/manifest/reviews';
 const query={partId:part.id,version:part.version,view:'3D'};
 const send=(input,origin=base)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(input)});
 const review={...query,author:'Тест',decision:'changes',text:'Проверить силуэт'};
 assert.equal((await send(review,'http://elsewhere.invalid')).status,403);
 assert.equal((await send({...review,version:'old'})).status,409);
 assert.equal((await send(review)).status,201);
 const {comments}=await (await fetch(endpoint+'?'+new URLSearchParams(query))).json();
 assert.equal(comments[0].decision,'changes');
 assert.equal(comments[0].text,review.text);
 assert.match(await readFile(join(dir,'manifest-reviews',part.id+'.jsonl'),'utf8'),/changes/);
});
test('retired catalog object is hidden and its direct model URLs stop being public',async()=>{
 const original=await (await fetch(base+'/api/catalog')).json();
 await writeFile(join(dir,'catalog-index.json'),JSON.stringify({objects:[]}));
 try{const c=await (await fetch(base+'/api/catalog')).json();assert.ok(!c.models.some(m=>m.id===id));
  assert.equal((await fetch(base+'/models/'+id+'.glb')).status,404);
  assert.equal((await fetch(base+'/api/models/'+id)).status,404);
 }finally{await writeFile(join(dir,'catalog-index.json'),JSON.stringify({objects:original.objects}));}
});
test('full downloads, gzip and byte ranges preserve bytes',async()=>{
 const r=await fetch(base+'/models/'+id+'.glb');assert.deepEqual(Buffer.from(await r.arrayBuffer()),glb);
 const z=await fetch(base+'/models/'+id+'.glb',{headers:{'Accept-Encoding':'gzip'}});assert.equal(z.headers.get('content-encoding'),'gzip');assert.deepEqual(Buffer.from(await z.arrayBuffer()),glb);
 const part=await fetch(base+'/models/'+id+'.glb',{headers:{Range:'bytes=0-11'}});assert.equal(part.status,206);assert.deepEqual(Buffer.from(await part.arrayBuffer()),glb.subarray(0,12));
 const suffix=await fetch(base+'/models/'+id+'.glb',{headers:{Range:'bytes=-4'}});assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),glb.subarray(-4));
 assert.equal((await fetch(base+'/models/'+id+'.glb',{headers:{Range:'bytes=999999-'}})).status,416);
});
test('public uploads rejected even with token; admin requires token and existing folder',async()=>{
 const options={method:'POST',body:glb,headers:{Authorization:'Bearer test-only-token'}};
 assert.equal((await fetch(base+'/api/models',options)).status,403);
 assert.equal((await fetch(admin+'/api/models',{method:'POST',body:glb})).status,401);
 assert.equal((await fetch(admin+'/api/models?folder=unknown',options)).status,400);
 const r=await fetch(admin+'/api/models?folder=H1%2FARMOR&name=Uploaded',options);assert.equal(r.status,201);
 const uploaded=await r.json();assert.deepEqual(Buffer.from(await (await fetch(base+'/models/'+uploaded.id+'.glb')).arrayBuffer()),glb);
});
