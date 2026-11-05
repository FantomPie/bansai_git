(() => {
 let current=null,generation=0,library;
 const panel=document.createElement('div'),two=document.createElement('button'),three=document.createElement('button'),full=document.createElement('a'),stage=document.createElement('div'),status=document.createElement('p');
 panel.className='armor-model-actions';panel.hidden=true;two.type=three.type='button';two.textContent='2D-изображение';three.textContent='Открыть 3D';full.textContent='Полный 3D-просмотр ↗';full.target='_blank';full.rel='noopener';panel.append(two,three,full);
 stage.id='armor-model-stage';stage.hidden=true;stage.append(status);document.getElementById('big').before(panel,stage);
 const info=Promise.all([fetch('data.json').then(r=>r.json()),fetch('/api/catalog').then(r=>r.json())]).then(([data,catalog])=>data.parts.filter(p=>p.modelFolder).map(p=>({...p,model:catalog.models.find(m=>m.folder===p.modelFolder)})));
 const mode=(is3D)=>{stage.hidden=!is3D;document.getElementById('big').hidden=is3D;document.querySelector('.photo-comments').hidden=is3D;document.getElementById('original').parentElement.hidden=is3D;document.getElementById('version').hidden=is3D;};
 const ensureLibrary=()=>library||(library=new Promise((resolve,reject)=>{if(customElements.get('model-viewer'))return resolve();const script=document.createElement('script');script.type='module';script.src='/vendor/model-viewer.min.js';script.onload=resolve;script.onerror=()=>reject(Error('Не удалось загрузить 3D-просмотрщик. Обновите страницу.'));document.head.append(script);}));
 const open=async()=>{
  if(!current?.model)return;const model=current.model;mode(true);status.textContent='Загружаю 3D-модель…';three.disabled=true;
  try{await ensureLibrary();if(current?.model?.id!==model.id)return;
   let viewer=stage.querySelector('model-viewer');if(!viewer){viewer=document.createElement('model-viewer');viewer.setAttribute('camera-controls','');viewer.setAttribute('environment-image','neutral');viewer.setAttribute('shadow-intensity','1');viewer.setAttribute('alt','Шлем в сборе — интерактивная 3D-модель');viewer.addEventListener('load',()=>status.textContent='Модель загружена · тяните для вращения, колесо — масштаб');viewer.addEventListener('error',()=>status.textContent='Не удалось открыть модель. Попробуйте полный 3D-просмотр.');stage.append(viewer);}if(viewer.getAttribute('src')!=='/models/'+model.id+'.glb')viewer.setAttribute('src','/models/'+model.id+'.glb');else status.textContent='Тяните для вращения, колесо — масштаб';
  }catch(e){status.textContent=e.message;}finally{three.disabled=false;}
 };
 three.onclick=open;two.onclick=()=>mode(false);
 window.showArmorModel=(part)=>{const request=++generation;mode(false);panel.hidden=true;current=null;info.then(parts=>{if(request!==generation)return;current=parts.find(p=>p.id===part.id);if(!current?.model)return;panel.hidden=false;full.href='/?model='+current.model.id;}).catch(()=>{});};
 const decorate=()=>info.then(parts=>{for(const p of parts){if(!p.model)continue;for(const card of document.querySelectorAll('#grid article')){if(!card.querySelector('h3')?.textContent.startsWith(p.id+' ·')||card.querySelector('.card-model-link'))continue;const link=document.createElement('a');link.className='card-model-link';link.href='/?model='+p.model.id;link.target='_blank';link.rel='noopener';link.textContent='Открыть 3D · '+(p.model.size/1048576).toFixed(1)+' МБ';card.append(link);}}}).catch(()=>{});
 new MutationObserver(decorate).observe(document.getElementById('grid'),{childList:true});decorate();
})();
