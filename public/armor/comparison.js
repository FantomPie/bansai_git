export function renderComparison({stage,viewer,part}){
 const references=part.comparison?.references;if(!references?.length||stage.querySelector('.armor-comparison'))return;
 const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
 const nav=make('nav',null,'armor-angle-nav');nav.setAttribute('aria-label','Ракурс сравнения');nav.append(make('strong','Сравнить ракурс:'));
 const grid=make('div',null,'armor-comparison'),modelPanel=make('section',null,'armor-compare-panel'),photoPanel=make('section',null,'armor-compare-panel');
 const modelHead=make('header'),photoHead=make('header'),filename=make('small');modelHead.append(make('strong','3D-модель'),make('small','Реконструкция · материал'));photoHead.append(make('strong','Оригинальное фото'),filename);
 const modelStage=make('div',null,'armor-compare-stage'),photoStage=make('div',null,'armor-compare-stage armor-photo-stage');modelStage.append(viewer);
 const photo=make('img');photo.alt='Оригинальное фото экспоната';photo.decoding='async';photoStage.append(photo);
 const modelHelp=make('div','Тяните — вращение · колесо — масштаб','armor-compare-controls');modelPanel.append(modelHead,modelStage,modelHelp);
 const controls=make('div',null,'armor-compare-controls'),minus=make('button','−'),plus=make('button','+'),reset=make('button','Сбросить'),percent=make('small','100%'),original=make('a','Открыть оригинал ↗');
 for(const b of [minus,plus,reset])b.type='button';minus.setAttribute('aria-label','Уменьшить оригинальное фото');plus.setAttribute('aria-label','Увеличить оригинальное фото');original.target='_blank';original.rel='noopener';controls.append(minus,plus,reset,percent,original);photoPanel.append(photoHead,photoStage,controls);grid.append(modelPanel,photoPanel);
 const note=make('p',part.comparison.note,'armor-comparison-note');
 let zoom=1;const showZoom=()=>{photo.style.width=zoom*100+'%';photo.style.height=zoom*100+'%';percent.textContent=Math.round(zoom*100)+'%';};
 minus.onclick=()=>{zoom=Math.max(1,zoom-.25);showZoom();};plus.onclick=()=>{zoom=Math.min(3,zoom+.25);showZoom();};reset.onclick=()=>{zoom=1;photoStage.scrollTo(0,0);showZoom();};
 const buttons=[];const choose=(reference,button)=>{viewer.cameraOrbit=reference.orbit;photo.src=reference.preview;photo.alt=part.title+' · оригинал · '+reference.label;filename.textContent=reference.label+' · '+reference.filename;original.href=reference.original;zoom=1;showZoom();photoStage.scrollTo(0,0);for(const b of buttons)b.setAttribute('aria-pressed',String(b===button));};
 for(const reference of references){const button=make('button',reference.label);button.type='button';button.onclick=()=>choose(reference,button);buttons.push(button);nav.append(button);}
 photo.onerror=()=>{filename.textContent='Фото не загрузилось. Откройте оригинал или выберите другой ракурс.';};
 stage.append(nav,grid,note);choose(references[0],buttons[0]);document.getElementById('modal').classList.add('has-armor-comparison');
}
