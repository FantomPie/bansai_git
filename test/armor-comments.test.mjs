import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {armorComments} from '../scripts/armor-comments.mjs';

test('shared image comments survive restart, separate views and keep simultaneous writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'armor-comments-')),manifestPath=join(root,'manifest.json');
 await writeFile(manifestPath,JSON.stringify({parts:[{id:'17',version:'v2',views:[{name:'FRONT',url:'front.png'},{name:'BACK',url:'back.png'}]}]}));
 let server,base;
 const start=async()=>{const handler=armorComments({dataRoot:root,manifestPath});server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost')));server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;};
 const stop=()=>new Promise(resolve=>server.close(resolve));
 const target={partId:'17',version:'v2',view:'FRONT'};
 const post=(body,headers={})=>fetch(base,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const list=async(extra={})=>(await(await fetch(base+'/?'+new URLSearchParams({...target,...extra}))).json()).comments;
 try{
  await start();
  const text='<img src=x onerror=alert(1)>\nСохранить гравировку';
  const first=await post({...target,author:'Alex',text});assert.equal(first.status,201);const saved=(await first.json()).comment;
  assert.equal(saved.image,'front.png');assert.equal(saved.text,text);
  assert.deepEqual(await list({view:'BACK'}),[]);assert.deepEqual(await list({version:'v1'}),[]);
  assert.equal((await post({...target,version:'v1',text:'Wrong version'})).status,409);
  assert.equal((await post({...target,text:' '})).status,400);
  assert.equal((await post({...target,text:'x'},{Origin:'https://another.example'})).status,403);
  assert.equal((await post({...target,text:'x'.repeat(17000)})).status,413);
  const responses=await Promise.all(Array.from({length:5},(_,n)=>post({...target,text:'Правка '+n})));
  assert.ok(responses.every(r=>r.status===201));assert.equal((await list()).length,6);
  await stop();await start();const restored=await list();assert.equal(restored.length,6);assert.equal(restored[0].id,saved.id);
  const disk=(await readFile(join(root,'armor-comments','17.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(disk.length,6);assert.equal(new Set(disk.map(c=>c.id)).size,6);
 }finally{if(server?.listening)await stop();await rm(root,{recursive:true,force:true});}
});
