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
  const catalog = await response.json();
  const parts = catalog.parts.flatMap(part => {
    if (!['19', '20'].includes(part.id)) return [part];
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

if (location.pathname.replace(/\/$/, '') === collection) {
  showArmor().catch(error => {
    const message = document.getElementById('load-error');
    message.textContent = error.message;
    message.hidden = false;
  });
}
