import {mkdir,readFile,appendFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export function armorComments({dataRoot,manifestPath}) {
 const rates=new Map();let writes=Promise.resolve();
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const fail=(status,message)=>Object.assign(new Error(message),{status});
 return async(req,res,url)=>{
  try{
   if(!['GET','POST'].includes(req.method))throw fail(405,'Метод не поддерживается');
   const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
   let input;
   if(req.method==='POST'){
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Отправляйте правки со страницы доспехов');
    if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fail(415,'Нужен JSON');
    if(Number(req.headers['content-length'])>16384){req.resume();throw fail(413,'Правка слишком длинная');}
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>16384)throw fail(413,'Правка слишком длинная');chunks.push(chunk);}
    try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail(400,'Не удалось прочитать правку');}
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Не удалось прочитать правку');
   }else input=Object.fromEntries(url.searchParams);
   const part=manifest.parts.find(p=>p.id===input.partId);
   if(!part)throw fail(400,'Деталь не найдена');
   const folder=dataRoot+'/armor-comments',file=folder+'/'+part.id+'.jsonl';
   if(req.method==='GET'){
    let lines='';try{lines=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    const comments=lines.split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(c=>c&&c.version===input.version&&c.view===input.view).slice(-200);
    return reply(res,200,{comments});
   }
   if(input.version!==part.version||!part.views.some(v=>v.name===input.view))throw fail(409,'Изображение обновилось. Обновите страницу перед отправкой');
   if(typeof input.text!=='string'||!input.text.trim()||input.text.trim().length>4000)throw fail(400,'Напишите правку от 1 до 4000 символов');
   if(input.author!==undefined&&(typeof input.author!=='string'||input.author.trim().length>80))throw fail(400,'Имя — не более 80 символов');
   const now=Date.now(),key=req.socket.remoteAddress;
   for(const [ip,r] of rates)if(now-r.start>60000)rates.delete(ip);
   const rate=rates.get(key)||{start:now,count:0};if(rate.count>=10)throw fail(429,'Слишком много правок. Подождите минуту');rate.count++;rates.set(key,rate);
   const comment={id:randomUUID(),partId:part.id,version:part.version,view:input.view,image:part.views.find(v=>v.name===input.view).url,author:input.author?.trim()||'Без имени',text:input.text.trim(),createdAt:new Date().toISOString()};
   const write=writes.then(async()=>{await mkdir(folder,{recursive:true});await appendFile(file,JSON.stringify(comment)+'\n','utf8');});writes=write.catch(()=>{});await write;
   return reply(res,201,{comment});
  }catch(e){return reply(res,e.status||500,{error:e.status?e.message:'Не удалось сохранить или загрузить правки. Попробуйте ещё раз'});}
 };
}
