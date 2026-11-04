(() => {
 const el=id=>document.getElementById(id),drafts=new Map();
 let context=null,loadId=0,saving=false;
 const label={FRONT:'Спереди',LEFT:'Слева',RIGHT:'Справа',BACK:'Сзади'};
 const message=(text,error=false)=>{el('comment-status').textContent=text;el('comment-status').classList.toggle('error',error);};
 async function change(c,action,text){
  const response=await fetch('/api/armor/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id:c.id,revision:c.revision,partId:c.partId,version:c.version,view:c.view,...(action==='edit'?{text}:{})})});
  let result;try{result=await response.json();}catch{result={};}
  if(!response.ok)throw Error(result.error||'Не удалось сохранить изменение. Попробуйте ещё раз.');
 }
 async function load(){
  if(!context)return;
  const current=context,request=++loadId;el('comment-list').textContent='Загружаю правки…';
  try{
   const response=await fetch('/api/armor/comments?'+new URLSearchParams({partId:current.partId,version:current.version,view:current.view}),{cache:'no-store'});
   let result;try{result=await response.json();}catch{result={};}if(!response.ok)throw Error(result.error||'Не удалось загрузить правки. Попробуйте позже.');
   if(context.key!==current.key||request!==loadId)return;
   el('comment-list').replaceChildren();
   if(!result.comments.length){el('comment-list').textContent='Правок к этому изображению пока нет.';return;}
   for(const c of result.comments){
    const item=document.createElement('article'),meta=document.createElement('div'),text=document.createElement('p');
    item.className='comment';meta.className='comment-meta';
    meta.textContent=c.author+' · '+new Date(c.createdAt).toLocaleString('ru-RU')+' · '+(label[c.view]||c.view)+(c.updatedAt?' · изменено '+new Date(c.updatedAt).toLocaleString('ru-RU'):'');
    const actions=document.createElement('div'),edit=document.createElement('button'),remove=document.createElement('button'),panel=document.createElement('div');
    actions.className='comment-actions';edit.type=remove.type='button';edit.textContent='Редактировать';remove.textContent='Удалить';remove.className='comment-delete';actions.append(edit,remove);
    const reset=()=>{panel.replaceChildren();actions.hidden=false;};
    const controls=(saveLabel,apply)=>{
     actions.hidden=true;const row=document.createElement('div'),save=document.createElement('button'),cancel=document.createElement('button'),error=document.createElement('span');
     row.className='comment-actions';save.type=cancel.type='button';save.textContent=saveLabel;cancel.textContent='Отмена';error.setAttribute('role','status');
     cancel.onclick=reset;save.onclick=async()=>{save.disabled=cancel.disabled=true;error.textContent='Сохраняю…';try{await apply();if(context.key===current.key){message(saveLabel==='Сохранить'?'Правка изменена':'Правка удалена');await load();}}catch(e){error.textContent=e.message;save.disabled=cancel.disabled=false;}};
     row.append(save,cancel,error);panel.append(row);
    };
    edit.onclick=()=>{
     panel.replaceChildren();const field=document.createElement('textarea');field.value=c.text;field.maxLength=4000;field.rows=4;field.setAttribute('aria-label','Редактировать правку');panel.append(field);
     controls('Сохранить',async()=>{if(!field.value.trim())throw Error('Правка не может быть пустой');await change(c,'edit',field.value.trim());});field.focus();
    };
    remove.onclick=()=>{panel.replaceChildren();const prompt=document.createElement('p');prompt.textContent='Удалить эту правку?';panel.append(prompt);controls('Да, удалить',()=>change(c,'delete'));};
    text.textContent=c.text;item.append(meta,text,actions,panel);el('comment-list').append(item);
   }
  }catch(error){if(context.key===current.key&&request===loadId)el('comment-list').textContent=error.message||'Не удалось загрузить правки. Нажмите «Обновить».';}
 }
 window.showArmorComments=(part,n)=>{
  const view=part.views[n].name,key=JSON.stringify([part.id,part.version,view]);
  if(context)drafts.set(context.key,el('comment-text').value);
  context={key,partId:part.id,version:part.version,view};
  el('comment-target').textContent=part.title+' · '+(label[view]||view);
  el('comment-text').value=drafts.get(key)||'';el('comment-submit').disabled=saving;message('');load();
 };
 el('comment-refresh').onclick=load;
 el('comment-form').onsubmit=async(event)=>{
  event.preventDefault();if(!context||saving)return;
  const current=context,text=el('comment-text').value.trim();if(!text){el('comment-text').focus();return;}
  const author=el('comment-author').value.trim();saving=true;el('comment-submit').disabled=true;message('Сохраняю…');
  try{
   const response=await fetch('/api/armor/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({partId:current.partId,version:current.version,view:current.view,author,text})});
   let result;try{result=await response.json();}catch{result={};}if(!response.ok)throw Error(result.error||'Не удалось отправить правку. Текст оставлен в поле — попробуйте позже.');
   drafts.delete(current.key);
   if(context.key===current.key){if(el('comment-text').value.trim()===text)el('comment-text').value='';message('Правка сохранена');await load();}
  }catch(error){if(context.key===current.key)message(error.message||'Не удалось сохранить. Текст оставлен в поле — попробуйте ещё раз.',true);}
  finally{saving=false;el('comment-submit').disabled=false;}
 };
})();
