const collectionId = /^\/armor-3d\/([A-Z0-9_]+)\/?$/.exec(location.pathname)?.[1];
const collection = collectionId ? '/armor-3d/' + collectionId : null;

async function showArmor() {
  const byId = id => document.getElementById(id);
  const viewer = byId('viewer');
  const download = byId('download');
  const status = byId('status');
  const previous = byId('previous');
  const next = byId('next');
  byId('collections').hidden = true;
  byId('armor').hidden = false;
  document.title = collectionId + ' · 3D-доспехи — BANSAI';
  byId('collection-title').textContent = collectionId;
  byId('exploded-scheme').hidden = collectionId !== 'BRANDENBURG_ARMOR';

  const response = await fetch(collection + '/data.json');
  if (!response.ok) throw new Error('Не удалось загрузить список деталей.');
  const catalog = await response.json();
  const parts = catalog.parts.flatMap(part => {
    if (collectionId !== 'BRANDENBURG_ARMOR' || !['19', '20'].includes(part.id)) return [part];
    const models = [part, ...(part.variants ?? [])];
    const side = part.id === '19' ? 'Левый' : 'Правый';
    const rows = [];
    for (const [suffix, description] of [['A', 'передняя створка с башмаком'], ['B', 'задняя створка']]) {
      const id = part.id + suffix;
      const group = models.filter(model => model.modelFile?.startsWith('BRANDENBURG_ARMOR_' + id + '_'));
      if (group.length) rows.push({...part, ...group[0], id, title: side + ' понож · ' + description,
        note: '', variants: group.slice(1)});
    }
    return rows.length ? rows : [part];
  });
  const ready = parts.filter(part => part.modelAsset);
  const links = parts.map(part => {
    const link = document.createElement('a');
    link.href = '#' + part.id;
    link.textContent = part.id + ' · ' + part.title;
    if (part.modelAsset) {
      const badge = document.createElement('span');
      badge.className = 'has-model';
      badge.textContent = '3D';
      link.append(badge);
    }
    return link;
  });
  byId('parts').replaceChildren(...links);
  byId('count').textContent = parts.length + ' пунктов · 3D опубликовано: ' + ready.length;
  byId('catalog').hidden = false;

  const comments=armorModelComments();
  let current;
  let viewerLibrary;
  function selectPart() {
    const id = location.hash.slice(1).toUpperCase();
    const part = parts.find(entry => entry.id === id) ?? parts.find(entry => entry.id === id + 'A') ?? ready[0] ?? parts[0];
    if (current === part) return;
    current = part;
    const index = parts.indexOf(part);
    links.forEach((link, i) => link.setAttribute('aria-current', String(i === index)));
    byId('part-title').textContent = part.id + ' · ' + part.title;
    const showBackplateViews = collectionId === 'BRANDENBURG_ARMOR' && part.id === '08';
    byId('backplate-views').hidden = !showBackplateViews;
    byId('backplate-views').open = showBackplateViews && !part.modelAsset;
    byId('model-note').textContent = part.note || '';
    previous.disabled = index === 0;
    next.disabled = index === parts.length - 1;
    const variants = part.modelAsset ? [part, ...(part.variants ?? [])] : [];
    const selector = byId('variant');
    selector.replaceChildren(...variants.map((item, i) =>
      new Option(item.label || (i ? 'Вариант ' + (i + 1) : 'Основной'), String(i))
    ));
    byId('variant-title').textContent = ['19', '20'].includes(part.id) ? 'Часть поножа' : 'Вариант';
    byId('variant-label').hidden = variants.length < 2;
    selector.onchange = () => showModel(variants[selector.selectedIndex], part);
    viewer.hidden = download.hidden = !part.modelAsset;
    if (!part.modelAsset) {
      viewer.removeAttribute('src');
      download.removeAttribute('href');
      status.textContent = 'Модель ещё не опубликована.';
      return;
    }
    showModel(part, part);
  }

  function showModel(model, part) {
    const modelUrl = collection + '/model/' + model.modelFile;
    download.href = modelUrl;
    const fbx=byId('download-fbx');fbx.hidden=!model.fbxAsset;fbx.href=model.fbxAsset?.url||'';fbx.download=model.fbxAsset?.filename||'';
    comments.select(model,part);
    download.download = model.modelFile;
    viewer.setAttribute('alt', [part.title, model.label].filter(Boolean).join(' · '));
    status.textContent = 'Загружается 3D-модель…';
    viewer.setAttribute('camera-orbit', model.cameraOrbit || part.cameraOrbit || '-28deg 80deg auto');
    viewer.setAttribute('src', modelUrl);
    viewerLibrary ??= import('/vendor/model-viewer.min.js');
    viewerLibrary.catch(() => {
      if (current === part) status.textContent = 'Не удалось запустить 3D-просмотр. Обновите страницу.';
      viewerLibrary = undefined;
    });
  }

  previous.addEventListener('click', () => { location.hash = parts[parts.indexOf(current) - 1].id; });
  next.addEventListener('click', () => { location.hash = parts[parts.indexOf(current) + 1].id; });
  viewer.addEventListener('load', () => { if (current?.modelAsset) status.textContent = ''; });
  viewer.addEventListener('error', () => {
    if (current?.modelAsset) status.textContent = 'Не удалось открыть 3D-модель. Обновите страницу или скачайте GLB.';
  });
  addEventListener('hashchange', selectPart);
  selectPart();
}

if (collection) {
  showArmor().catch(error => {
    const message = document.getElementById('load-error');
    message.textContent = error.message;
    message.hidden = false;
  });
}

function armorModelComments(){
 const el=id=>document.getElementById(id), drafts=new Map();
 let context=null, editing=null, serial=0, saving=false, savingDetail=false, detail='unspecified';
 const message=t=>el('detail-message').textContent=t;
 function paintDetail(value,text){
  detail=value;
  el('detail-needed').setAttribute('aria-pressed',String(value==='closeup'));
  el('detail-simple').setAttribute('aria-pressed',String(value==='stylized'));
  el('detail-summary').textContent=text||({closeup:'Нужна детализация',stylized:'Детализация не нужна',unspecified:'Пока не выбрано'}[value]);
 }
 function reset(){editing=null;el('detail-cancel').hidden=true;el('detail-save').textContent='Сохранить комментарий';el('detail-text').value='';}
 async function api(body){
  const r=await fetch('/api/armor3d/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Не удалось сохранить');return d;
 }
 async function setDetail(value){
  if(!context||savingDetail||detail===value)return;
  const c=context,previous=detail;savingDetail=true;serial++;
  el('detail-needed').disabled=el('detail-simple').disabled=true;
  paintDetail(value,'Сохраняю…');
  try{await api({...c,action:'detail',detail:value});if(context===c){await load();paintDetail(value,'Сохранено · '+(value==='closeup'?'Нужна детализация':'Детализация не нужна'));}}
  catch(e){if(context===c)paintDetail(previous,'Не сохранено: '+e.message);}
  finally{savingDetail=false;el('detail-needed').disabled=el('detail-simple').disabled=false;if(context!==c)load();}
 }
 el('detail-needed').onclick=()=>setDetail('closeup');
 el('detail-simple').onclick=()=>setDetail('stylized');
 async function load(){
  if(!context)return;
  const c=context,n=++serial;
  el('detail-list').textContent='Загружаю комментарии…';
  try{
   const r=await fetch('/api/armor3d/comments?'+new URLSearchParams(c),{cache:'no-store'}),d=await r.json();
   if(!r.ok)throw Error(d.error||'Не удалось загрузить');
   if(context!==c||n!==serial)return;
   if(!savingDetail)paintDetail(d.detail||'unspecified');
   const list=el('detail-list');list.replaceChildren();
   if(!d.comments.length)list.textContent='Комментариев пока нет.';
   for(const entry of d.comments){
    const card=document.createElement('article'),meta=document.createElement('small'),text=document.createElement('p'),actions=document.createElement('div');
    meta.textContent=entry.author+' · '+new Date(entry.createdAt).toLocaleString('ru-RU');
    text.textContent=entry.text;actions.className='bar';
    const edit=document.createElement('button');edit.type='button';edit.textContent='Редактировать';
    edit.onclick=()=>{editing=entry;el('detail-text').value=entry.text;el('detail-cancel').hidden=false;el('detail-save').textContent='Сохранить изменения';el('detail-text').focus();};
    const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить';
    remove.onclick=async()=>{
     if(!confirm('Удалить этот комментарий?'))return;
     remove.disabled=true;
     try{await api({...c,action:'delete',id:entry.id,revision:entry.revision});if(context===c){if(editing?.id===entry.id)reset();message('Комментарий удалён');await load();}}
     catch(e){if(context===c)message(e.message);}finally{remove.disabled=false;}
    };
    actions.append(edit,remove);card.append(meta,text,actions);list.append(card);
   }
  }catch(e){if(context===c){el('detail-list').textContent=e.message;}}
 }
 el('detail-form').onsubmit=async e=>{
  e.preventDefault();if(!context||saving)return;
  const c=context,text=el('detail-text').value.trim();
  if(!text){message('Напишите комментарий');return;}
  saving=true;el('detail-save').disabled=true;
  try{
   await api({...c,action:editing?'edit':'create',...(editing?{id:editing.id,revision:editing.revision}:{}),text,author:el('detail-author').value});
   drafts.delete(c.version);
   if(context===c){reset();message('Комментарий сохранён');await load();}
  }catch(e){if(context===c)message(e.message);}
  finally{saving=false;el('detail-save').disabled=false;}
 };
 el('detail-refresh').onclick=load;el('detail-cancel').onclick=()=>{reset();load();};
 return {select(model,part){
  if(context)drafts.set(context.version,el('detail-text').value);
  reset();context={partId:model.modelFile.replace(/\.glb$/,''),version:model.modelAsset.sha256,view:'3D'};
  el('detail-text').value=drafts.get(context.version)||'';
  el('detail-comments').hidden=false;paintDetail('unspecified','Загружаю отметку…');message('');load();
 }};
}
