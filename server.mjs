import http from 'node:http';
import {mkdir,readFile,writeFile,rename,unlink,readdir,stat} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {armorComments} from './scripts/armor-comments.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const dataRoot=(process.env.DATA_DIR||root+'data').replaceAll(String.fromCharCode(92),'/').replace(/\/$/,'');
const dir=dataRoot+'/models/';
const adminEnabled=process.env.ENABLE_ADMIN==='true';
await mkdir(dir,{recursive:true});
const token=process.env.UPLOAD_TOKEN;
const importer={status:{enabled:false}};
const handleArmorComments=armorComments({dataRoot,manifestPath:root+'public/armor/data.json'});
async function catalogIndex(){try{return JSON.parse(await readFile(dataRoot+'/catalog-index.json','utf8'));}catch{return {objects:[]};}}
const published=(model,index)=>!model.hidden&&(!model.folder||index.objects.some(o=>o.path===model.folder));
const send=(res,status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));};
// Stable assets: conditional caching, byte ranges and optional precompressed transfers.
async function assetResponse(req,res,path,type){
 const info=await stat(path),etag='"'+info.size.toString(16)+'-'+Math.trunc(info.mtimeMs).toString(16)+'"';
 const headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','ETag':etag,'Last-Modified':info.mtime.toUTCString(),'Cache-Control':'public, max-age=0, must-revalidate','Vary':'Accept-Encoding','Accept-Ranges':'bytes'};
 if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
 let file=path,start=0,end=info.size-1,size=info.size;
 const range=req.headers.range;
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{...headers,'Content-Range':'bytes */'+size});return res.end();}if(m[1]){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;}else{start=Math.max(0,size-Number(m[2]));}if(start>end||start>=size){res.writeHead(416,{...headers,'Content-Range':'bytes */'+size});return res.end();}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});}
 else{if(/(?:^|[, ])gzip(?:[, ;]|$)/.test(req.headers['accept-encoding']||'')){try{const compressed=await stat(path+'.gz');if(compressed.mtimeMs>=info.mtimeMs){file=path+'.gz';size=compressed.size;headers['Content-Encoding']='gzip';}}catch{}}res.writeHead(200,{...headers,'Content-Length':size});end=size-1;}
 if(req.method==='HEAD')return res.end();const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
}
const adminPort=Number(process.env.ADMIN_PORT)||37842;
const handler=async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const localAdmin=adminEnabled&&req.socket.localPort===adminPort;
  if(url.pathname==='/api/armor/comments')return await handleArmorComments(req,res,url);
  if(req.method==='GET'&&url.pathname==='/healthz')return send(res,200,{status:'ok'});
  if(['GET','HEAD'].includes(req.method)&&url.pathname==='/vendor/model-viewer.min.js')return await assetResponse(req,res,root+'public/vendor/model-viewer.min.js','text/javascript; charset=utf-8');
  if(['GET','HEAD'].includes(req.method)&&['/armor','/armor/','/armor/index.html','/armor/data.json'].includes(url.pathname))return await assetResponse(req,res,root+'public/armor/'+(url.pathname.endsWith('data.json')?'data.json':'index.html'),url.pathname.endsWith('data.json')?'application/json; charset=utf-8':'text/html; charset=utf-8');
  if(['GET','HEAD'].includes(req.method)&&['/armor/comments.js','/armor/comments.css'].includes(url.pathname))return await assetResponse(req,res,root+'public'+url.pathname,url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
  if(['GET','HEAD'].includes(req.method)&&/^\/evidence\/[A-Za-z0-9_.-]+\.jpg$/.test(url.pathname))return await assetResponse(req,res,dataRoot+url.pathname,'image/jpeg');
  if(req.method==='GET'&&url.pathname==='/api/access')return send(res,200,{canUpload:localAdmin});
  if(req.method==='GET'&&url.pathname==='/api/catalog'){
   const index=await catalogIndex();
   const models=[];for(const file of await readdir(dir)){if(!/^[0-9a-f-]{36}\.json$/.test(file))continue;try{const m=JSON.parse(await readFile(dir+file,'utf8'));if(!published(m,index))continue;const info=await stat(dir+file.replace('.json','.glb'));models.push({...m,id:file.slice(0,-5),createdAt:m.createdAt||info.birthtime.toISOString()});}catch{}}
   models.sort((a,b)=>(b.updatedAt||b.createdAt).localeCompare(a.updatedAt||a.createdAt));return send(res,200,{...index,models,autoImport:importer.status});
  }
  if(req.method==='POST'&&url.pathname==='/api/models'){
   if(!localAdmin)return send(res,403,{error:'Загрузка доступна только на локальном компьютере'});
   const provided=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
   if(!token||provided.length!==expected.length||!timingSafeEqual(provided,expected))return send(res,401,{error:'Неверный ключ загрузки'});
   const folder=(url.searchParams.get('folder')||'').slice(0,400);if(folder){let index;try{index=JSON.parse(await readFile(dataRoot+'/catalog-index.json','utf8'));}catch{return send(res,400,{error:'Каталог папок недоступен'});}if(!index.objects.some(o=>o.path===folder))return send(res,400,{error:'Выбери существующий объект каталога'});}
   const id=randomUUID(),temp=dir+id+'.tmp';let size=0,header=Buffer.alloc(0);
   const limit=new Transform({transform(chunk,enc,cb){size+=chunk.length;if(header.length<12)header=Buffer.concat([header,chunk]).subarray(0,12);cb(size>512*1024*1024?new Error('Максимум 512 МБ'):null,chunk);}});
   try{await pipeline(req,limit,createWriteStream(temp,{flags:'wx'}));if(header.length!==12||header.toString('ascii',0,4)!=='glTF'||header.readUInt32LE(4)!==2||header.readUInt32LE(8)!==size)throw new Error('Нужен корректный GLB 2.0');await rename(temp,dir+id+'.glb');await writeFile(dir+id+'.json',JSON.stringify({name:(url.searchParams.get('name')||'Модель').slice(0,160),size,folder,createdAt:new Date().toISOString()}));return send(res,201,{id,url:'/?model='+id});}catch(e){await unlink(temp).catch(()=>{});return send(res,400,{error:e.message});}
  }
  const match=url.pathname.match(/^\/(api\/models|models)\/([0-9a-f-]{36})(\.glb)?$/);
  if(['GET','HEAD'].includes(req.method)&&match){const info=await readFile(dir+match[2]+'.json');if(!published(JSON.parse(info),await catalogIndex()))return send(res,404,{error:'Модель не опубликована'});const metadata=match[1]==='api/models';if(metadata)return send(res,200,info);return await assetResponse(req,res,dir+match[2]+'.glb','model/gltf-binary');}
  if(req.method==='GET'&&url.pathname==='/')return send(res,200,await readFile(root+'public/index.html'),'text/html; charset=utf-8');
  send(res,404,{error:'Не найдено'});
 }catch(e){send(res,e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'Модель не найдена':'Ошибка сервера'});}
};
const server=http.createServer(handler);
const adminServer=http.createServer(handler);
adminServer.requestTimeout=300000;
if(adminEnabled)adminServer.listen(adminPort,process.env.ADMIN_HOST||'127.0.0.1',()=>console.log('Local uploads: http://127.0.0.1:'+adminPort));
server.requestTimeout=300000;
const shutdown=()=>{server.close();if(adminEnabled)adminServer.close();};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
server.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log('Modelshare: http://localhost:'+(process.env.PORT||3000)+(token?'':' — задайте UPLOAD_TOKEN для загрузки')));


