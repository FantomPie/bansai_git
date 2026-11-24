import {mkdir,readFile,appendFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export function armorComments({dataRoot,manifestPath,storage='armor-comments',decisions=false,modelCatalog=false}) {
 const rates=new Map();let writes=Promise.resolve();
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const fail=(status,message)=>Object.assign(new Error(message),{status});
 const readComments=async(file)=>{
  let lines='';try{lines=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const records=new Map();
  for(const line of lines.split('\n').filter(Boolean)){
   let entry;try{entry=JSON.parse(line);}catch{continue;}
   if(!entry.event)records.set(entry.id,{...entry,revision:entry.revision||entry.createdAt});
   else{const previous=records.get(entry.id);if(!previous||previous.deleted)continue;
    records.set(entry.id,{...previous,...(entry.event==='edit'?{text:entry.text,...(entry.detail?{detail:entry.detail}:{})}:{deleted:true}),updatedAt:entry.updatedAt,revision:entry.revision});}
  }
  return records;
 };
 return async(req,res,url)=>{
  try{
   if(!['GET','POST'].includes(req.method))throw fail(405,'Метод не поддерживается');
   const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
   if(modelCatalog)manifest.parts=manifest.parts.flatMap(p=>[p,...(p.variants||[])]).filter(p=>p.modelAsset).map(p=>({id:p.modelFile.replace(/\.glb$/,''),version:p.modelAsset.sha256,views:[{name:'3D',url:p.modelAsset.url}]}));
   let input;
   if(req.method==='POST'){
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Отправляйте правки со страницы сайта');
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fail(415,'Нужен JSON');
    if(Number(req.headers['content-length'])>16384){req.resume();throw fail(413,'Правка слишком длинная');}
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>16384)throw fail(413,'Правка слишком длинная');chunks.push(chunk);}
    try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'Не удалось прочитать правку');}
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Не удалось прочитать правку');
   }else input=Object.fromEntries(url.searchParams);
   const part=manifest.parts.find(p=>p.id===input.partId);
   if(!part)throw fail(400,'Деталь не найдена');
   if(decisions&&!part.modelAsset)throw fail(409,'Проверенная модель ещё не опубликована');
   const folder=dataRoot+'/'+storage,file=folder+'/'+part.id+'.jsonl';
   if(req.method==='GET'){
    const comments=[...(await readComments(file)).values()].filter(c=>!c.deleted&&c.version===input.version&&c.view===input.view).slice(-200);
    if(modelCatalog){
     const records=(await readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;})).split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
     const setting=records.findLast(r=>r.event==='detail'&&r.version===input.version&&r.view===input.view);
     const legacy=comments.findLast(c=>c.detail&&c.detail!=='unspecified');
     return reply(res,200,{comments,detail:setting?.detail||legacy?.detail||'unspecified'});
    }
    return reply(res,200,{comments});
   }
   if(input.version!==part.version||!part.views.some(v=>v.name===input.view))throw fail(409,'Изображение обновилось. Обновите страницу перед отправкой');
   if(modelCatalog&&input.detail!==undefined&&!['unspecified','closeup','stylized'].includes(input.detail))throw fail(400,'Выберите уровень детализации');
   const action=input.action||'create';if(!['create','edit','delete',...(modelCatalog?['detail']:[])].includes(action))throw fail(400,'Неизвестное действие');
   if(decisions&&(action!=='create'||!['approved','changes','comment'].includes(input.decision)))throw fail(400,'Выберите решение по модели');
   if(action==='detail'&&!['unspecified','closeup','stylized'].includes(input.detail))throw fail(400,'Выберите уровень детализации');
   if(!['delete','detail'].includes(action)&&(typeof input.text!=='string'||!input.text.trim()||input.text.trim().length>4000))throw fail(400,'Напишите правку от 1 до 4000 символов');
   if(input.author!==undefined&&(typeof input.author!=='string'||input.author.trim().length>80))throw fail(400,'Имя — не более 80 символов');
   const now=Date.now(),key=req.socket.remoteAddress;
   for(const [ip,r] of rates)if(now-r.start>60000)rates.delete(ip);
   const rate=rates.get(key)||{start:now,count:0};if(rate.count>=10)throw fail(429,'Слишком много правок. Подождите минуту');rate.count++;rates.set(key,rate);
   let comment;
   const write=writes.then(async()=>{
    let record;
    if(action==='detail')record=comment={event:'detail',id:randomUUID(),partId:part.id,version:part.version,view:input.view,detail:input.detail,updatedAt:new Date().toISOString()};
    else if(action==='create')record=comment={id:randomUUID(),revision:randomUUID(),partId:part.id,version:part.version,view:input.view,image:part.views.find(v=>v.name===input.view).url,author:input.author?.trim()||'Без имени',text:input.text.trim(),...(modelCatalog?{detail:input.detail||'unspecified'}:{}),createdAt:new Date().toISOString(),...(decisions?{decision:input.decision}:{})};
    else{
     const previous=(await readComments(file)).get(input.id);
     if(!previous||previous.deleted||previous.version!==input.version||previous.view!==input.view)throw fail(404,'Правка уже удалена или относится к другому изображению');
     if(input.revision!==previous.revision)throw fail(409,'Правка уже изменена. Обновите список перед сохранением');
     record={event:action,id:previous.id,revision:randomUUID(),updatedAt:new Date().toISOString(),...(action==='edit'?{text:input.text.trim(),...(modelCatalog?{detail:input.detail||'unspecified'}:{})}:{})};
     comment={...previous,...(action==='edit'?{text:record.text,...(modelCatalog?{detail:record.detail}:{})}:{deleted:true}),revision:record.revision,updatedAt:record.updatedAt};
    }
    await mkdir(folder,{recursive:true});await appendFile(file,JSON.stringify(record)+'\n','utf8');
   });writes=write.catch(()=>{});await write;
   return reply(res,action==='create'?201:200,{comment});
  }catch(e){return reply(res,e.status||500,{error:e.status?e.message:'Не удалось сохранить или загрузить правки. Попробуйте ещё раз'});}
 };
}
