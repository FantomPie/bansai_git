const collection = '/armor-3d/BRANDENBURG_ARMOR';

async function showArmor() {
  const byId = id => document.getElementById(id);
  const viewer = byId('viewer');
  const download = byId('download');
  const status = byId('status');
  const previous = byId('previous');
  const next = byId('next');
  byId('collections').hidden = true;
  byId('armor').hidden = false;
  document.title = 'BRANDENBURG_ARMOR · 3D-доспехи — BANSAI';

  const response = await fetch(collection + '/data.json');
  if (!response.ok) throw new Error('Не удалось загрузить список деталей.');
  const {parts} = await response.json();
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

  let current;
  let viewerLibrary;
  function selectPart() {
    const part = parts.find(entry => '#' + entry.id === location.hash) ?? ready[0] ?? parts[0];
    if (current === part) return;
    current = part;
    const index = parts.indexOf(part);
    links.forEach((link, i) => link.setAttribute('aria-current', String(i === index)));
    byId('part-title').textContent = part.id + ' · ' + part.title;
    previous.disabled = index === 0;
    next.disabled = index === parts.length - 1;
    viewer.hidden = download.hidden = !part.modelAsset;
    if (!part.modelAsset) {
      viewer.removeAttribute('src');
      download.removeAttribute('href');
      status.textContent = 'Модель ещё не опубликована.';
      return;
    }
    const modelUrl = collection + '/model/' + part.modelFile;
    download.href = modelUrl;
    download.download = part.modelFile;
    viewer.setAttribute('alt', part.title);
    status.textContent = 'Загружается 3D-модель…';
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

if (location.pathname.replace(/\/$/, '') === collection) {
  showArmor().catch(error => {
    const message = document.getElementById('load-error');
    message.textContent = error.message;
    message.hidden = false;
  });
}
