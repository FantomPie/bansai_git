const byId = id => document.getElementById(id);
const form = byId('review');
const viewer = byId('viewer');
const variants = byId('variants');
const labels = {approved:'Согласовано', changes:'Нужны правки', comment:'Комментарий'};
let selected;
let parts;

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Не удалось связаться с сервером');
  return body;
}

async function showReviews(part) {
  const params = new URLSearchParams({partId:part.id, version:part.version, view:'3D'});
  const {comments} = await request('/api/manifest/reviews?' + params);
  if (selected !== part) return;
  const latest = comments.findLast(entry => entry.decision !== 'comment');
  byId('status').textContent = latest ? 'Последнее решение команды — ' + labels[latest.decision] : 'На согласовании';
  const history = comments.slice().reverse().map(entry => {
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.author + ' · ' + labels[entry.decision];
    const detail = document.createElement('p');
    detail.textContent = entry.text;
    item.append(title, detail);
    return item;
  });
  byId('history').replaceChildren(...history);
}

function selectPart(part) {
  selected = part;
  byId('title').textContent = part.shot + ' · ' + part.title;
  const options = parts.filter(entry => entry.role === part.role);
  variants.replaceChildren(...options.map(entry => new Option(entry.variant, entry.id)));
  variants.value = part.id;
  byId('variants-label').hidden = options.length < 2;
  for (const button of byId('roles').children) button.setAttribute('aria-current', String(button.dataset.role === part.role));
  const url = part.views[0].url;
  viewer.alt = part.title;
  viewer.src = url;
  byId('download').href = url;
  byId('download').download = part.id + '.glb';
  byId('history').replaceChildren();
  byId('status').textContent = 'Загрузка решений…';
  byId('model-error').textContent = '';
  byId('message').textContent = '';
  history.replaceState(null, '', '#' + part.id);
  showReviews(part).catch(error => {
    if (selected === part) byId('status').textContent = error.message;
  });
}

viewer.addEventListener('error', () => { byId('model-error').textContent = 'Не удалось открыть 3D. Попробуйте обновить страницу.'; });
viewer.addEventListener('load', () => {
  for (const material of viewer.model.materials) {
    const surface = material.pbrMetallicRoughness;
    surface.setBaseColorFactor([0.48, 0.48, 0.48, 1]);
    surface.setMetallicFactor(0);
    surface.setRoughnessFactor(0.8);
  }
  byId('model-error').textContent = '';
});
variants.addEventListener('change', () => selectPart(parts.find(entry => entry.id === variants.value)));
addEventListener('hashchange', () => {
  const part = parts?.find(entry => '#' + entry.id === location.hash);
  if (part && part !== selected) selectPart(part);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const part = selected;
  if (!part) return;
  const data = new FormData(form);
  const author = data.get('author').trim();
  const decision = data.get('decision');
  const text = data.get('text').trim();
  if (!author || (!text && decision !== 'approved')) {
    byId('message').textContent = author ? 'Добавьте комментарий.' : 'Укажите имя.';
    return;
  }
  const submit = form.querySelector('button');
  submit.disabled = true;
  byId('message').textContent = 'Сохраняю…';
  try {
    await request('/api/manifest/reviews', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({partId:part.id, version:part.version, view:'3D', author, decision, text:text || labels[decision]})
    });
    if (selected !== part) return;
    form.elements.text.value = '';
    byId('message').textContent = 'Решение сохранено.';
    await showReviews(part);
  } catch (error) {
    if (selected === part) byId('message').textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

try {
  ({parts} = await request('/manifest/data.json'));
  const roles = parts.filter(entry => entry.id === entry.role);
  byId('count').textContent = roles.length + ' моделей · ' + (parts.length - roles.length) + ' альтернативные версии';
  byId('roles').replaceChildren(...roles.map(part => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.role = part.role;
    button.textContent = part.shot + ' · ' + part.title;
    button.addEventListener('click', () => selectPart(part));
    return button;
  }));
  selectPart(parts.find(part => '#' + part.id === location.hash) || roles[0]);
} catch (error) {
  byId('title').textContent = error.message;
  form.hidden = true;
}
