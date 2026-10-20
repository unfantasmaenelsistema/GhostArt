/* GhostArt: galería que se construye sola a partir de manifest.json
   (lo regenera la GitHub Action en cada push). Si el manifiesto aún no existe,
   lista img/ con la API de GitHub como plan B. */
(() => {
  'use strict';

  const REPO = 'unfantasmaenelsistema/GhostArt';
  const BRANCH = 'main';
  const LOTE = 48;

  const I18N = {
    es: {
      tagline: 'Ilustraciones anime de ciberseguridad',
      blog: 'Blog',
      search: 'Buscar por tema: phishing, kerberos, wifi…',
      sortNew: 'Más recientes', sortAz: 'Nombre A–Z', sortRand: 'Aleatorio',
      all: 'Todas', loose: 'Sin clasificar',
      count: (n, t) => n === t ? `${t} imágenes` : `${n} de ${t} imágenes`,
      none: 'No hay imágenes que coincidan.',
      loading: 'Cargando galería…',
      error: 'No se pudo cargar la galería. Prueba a recargar dentro de un rato.',
      fallback: 'Mostrando la lista directa del repositorio (el índice se está regenerando).',
      download: 'Descargar', copyUrl: 'Copiar URL', copyLink: 'Enlace a esta vista',
      copied: 'Copiado al portapapeles', copyFail: 'No se pudo copiar',
      foot: 'La galería se actualiza sola al subir imágenes a img/.',
      lic: 'Imágenes CC BY 4.0',
    },
    en: {
      tagline: 'Anime-style cybersecurity illustrations',
      blog: 'Blog',
      search: 'Search by topic: phishing, kerberos, wifi…',
      sortNew: 'Newest', sortAz: 'Name A–Z', sortRand: 'Random',
      all: 'All', loose: 'Unsorted',
      count: (n, t) => n === t ? `${t} images` : `${n} of ${t} images`,
      none: 'No images match.',
      loading: 'Loading gallery…',
      error: 'The gallery could not be loaded. Try reloading in a while.',
      fallback: 'Showing the raw repository listing (the index is being rebuilt).',
      download: 'Download', copyUrl: 'Copy URL', copyLink: 'Link to this view',
      copied: 'Copied to clipboard', copyFail: 'Could not copy',
      foot: 'The gallery updates itself when images are pushed to img/.',
      lic: 'Images CC BY 4.0',
    },
  };

  // Nombres bonitos de las carpetas conocidas; cualquier carpeta nueva se muestra igual con su nombre.
  const CATS = {
    'carrera-ctf': ['Carrera, CTF y labs', 'Career, CTF & labs'],
    'cloud-devsecops': ['Cloud y DevSecOps', 'Cloud & DevSecOps'],
    'cripto': ['Criptografía', 'Cryptography'],
    'defensa-soc': ['Defensa y SOC', 'Defense & SOC'],
    'forense-dfir': ['Forense y DFIR', 'Forensics & DFIR'],
    'fraude-ingenieria-social': ['Fraude e ingeniería social', 'Fraud & social engineering'],
    'gestion-normativa': ['Gestión y normativa', 'GRC & regulation'],
    'ia-llm': ['IA y LLM', 'AI & LLM'],
    'identidad-ad': ['Identidad y AD', 'Identity & AD'],
    'inteligencia-amenazas': ['Inteligencia de amenazas', 'Threat intelligence'],
    'malware-reversing': ['Malware y reversing', 'Malware & reversing'],
    'movil': ['Móvil', 'Mobile'],
    'ofensiva-redteam': ['Ofensiva y Red Team', 'Offensive & Red Team'],
    'osint': ['OSINT', 'OSINT'],
    'ot-ics': ['OT / ICS', 'OT / ICS'],
    'radio-hardware-iot': ['Radio, hardware e IoT', 'Radio, hardware & IoT'],
    'redes-wifi': ['Redes y WiFi', 'Networking & WiFi'],
    'sistemas-hardening': ['Sistemas y hardening', 'Systems & hardening'],
    'web-appsec': ['Web y AppSec', 'Web & AppSec'],
  };

  const $ = (s) => document.querySelector(s);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  let lang = store.get('ga_lang') || (navigator.language || 'es').slice(0, 2);
  if (!I18N[lang]) lang = 'es';
  const t = (k) => I18N[lang][k];

  const state = { all: [], list: [], shown: 0, cat: '', q: '', sort: 'new', idx: -1, seed: Math.random() };

  // ---------- Datos ----------
  const nombreBonito = (n) => n.replace(/-/g, ' ');
  const catLabel = (c) => !c ? t('loose') : (CATS[c] ? CATS[c][lang === 'es' ? 0 : 1] : nombreBonito(c));
  const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  async function cargar() {
    try {
      const r = await fetch('manifest.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return { images: (await r.json()).images, fallback: false };
    } catch (e) {
      return { images: await desdeApi(), fallback: true };
    }
  }

  async function desdeApi() {
    const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`);
    if (!r.ok) throw new Error('api ' + r.status);
    const exts = /\.(webp|jpe?g|png|gif|avif)$/i;
    return (await r.json()).tree
      .filter((x) => x.type === 'blob' && x.path.startsWith('img/') && exts.test(x.path))
      .map((x) => {
        const rel = x.path.slice(4);
        const partes = rel.split('/');
        return {
          p: x.path, t: x.path, c: partes.length > 1 ? partes[0] : '',
          n: partes[partes.length - 1].replace(exts, ''), s: x.size, d: '',
        };
      });
  }

  // ---------- Filtro y orden ----------
  function hash(str) {
    let h = 2166136261 ^ Math.floor(state.seed * 1e9);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function aplicar() {
    const palabras = sinTildes(state.q).split(/[\s,]+/).filter(Boolean);
    let l = state.all.filter((i) =>
      (!state.cat || i.c === state.cat) &&
      palabras.every((w) => i._busca.includes(w)));
    if (state.sort === 'az') l.sort((a, b) => a.n.localeCompare(b.n));
    else if (state.sort === 'rand') l.sort((a, b) => hash(a.p) - hash(b.p));
    else l.sort((a, b) => (b.d || '').localeCompare(a.d || '') || a.n.localeCompare(b.n));
    state.list = l;
    state.shown = 0;
    $('#grid').innerHTML = '';
    pintarMas();
    $('#status').textContent = t('count')(l.length, state.all.length) + (state.fallbackMsg ? ' · ' + t('fallback') : '');
    if (!l.length) {
      const e = document.createElement('p');
      e.className = 'empty';
      e.textContent = t('none');
      $('#grid').append(e);
    }
    pintarCats();
    guardarUrl();
  }

  function pintarCats() {
    const cuenta = {};
    for (const i of state.all) cuenta[i.c] = (cuenta[i.c] || 0) + 1;
    const cats = Object.keys(cuenta).sort((a, b) => (a === '') - (b === '') || catLabel(a).localeCompare(catLabel(b)));
    const nav = $('#cats');
    nav.innerHTML = '';
    const boton = (c, label, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cat';
      b.setAttribute('aria-pressed', String(state.cat === c));
      b.append(label + ' ');
      const k = document.createElement('b');
      k.textContent = n;
      b.append(k);
      b.onclick = () => { state.cat = c; aplicar(); };
      nav.append(b);
    };
    boton('', t('all'), state.all.length);
    for (const c of cats) if (c !== '' || cuenta[''] ) boton(c, catLabel(c), cuenta[c]);
  }

  function pintarMas() {
    const grid = $('#grid');
    const fin = Math.min(state.shown + LOTE, state.list.length);
    const frag = document.createDocumentFragment();
    for (let k = state.shown; k < fin; k++) {
      const i = state.list[k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.dataset.k = k;
      b.title = nombreBonito(i.n);
      const img = new Image();
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = nombreBonito(i.n);
      img.onload = () => img.classList.add('ok');
      img.onerror = () => { if (img.src.indexOf(i.t) >= 0 && i.t !== i.p) img.src = i.p; };
      img.src = i.t;
      const cap = document.createElement('span');
      cap.className = 'cap';
      cap.textContent = nombreBonito(i.n);
      b.append(img, cap);
      frag.append(b);
    }
    grid.append(frag);
    state.shown = fin;
  }

  // ---------- Visor ----------
  const abs = (p) => new URL(p, location.href).href;
  const kb = (s) => s > 1048576 ? (s / 1048576).toFixed(1) + ' MB' : Math.round(s / 1024) + ' KB';

  function abrir(k) {
    const i = state.list[k];
    if (!i) return;
    state.idx = k;
    const v = $('#viewer');
    $('#v-img').src = i.p;
    $('#v-img').alt = nombreBonito(i.n);
    $('#v-title').textContent = nombreBonito(i.n);
    $('#v-meta').textContent = [catLabel(i.c), i.w ? `${i.w}×${i.h}` : '', i.s ? kb(i.s) : '', `${k + 1}/${state.list.length}`]
      .filter(Boolean).join(' · ');
    $('#v-dl').href = i.p;
    $('#v-dl').setAttribute('download', i.p.split('/').pop());
    const sig = state.list[k + 1];
    if (sig) new Image().src = sig.p;
    if (!v.open) v.showModal();
    guardarUrl();
  }
  function cerrar() { $('#viewer').close(); }
  function mover(d) {
    const n = state.idx + d;
    if (n < 0 || n >= state.list.length) return;
    while (n >= state.shown) pintarMas();
    abrir(n);
  }

  async function copiar(tipo) {
    const i = state.list[state.idx];
    const url = abs(i.p);
    const alt = nombreBonito(i.n);
    const texto = {
      url,
      md: `![${alt}](${url})\n*Ilustración: [Un Fantasma en el Sistema](https://www.unfantasmaenelsistema.com) (CC BY 4.0)*`,
      html: `<img src="${url}" alt="${alt}" width="${i.w || ''}" height="${i.h || ''}" loading="lazy">`,
      link: location.href,
    }[tipo];
    try {
      await navigator.clipboard.writeText(texto);
      toast(t('copied'));
    } catch (e) {
      toast(t('copyFail'));
    }
  }

  let toastT;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 1600);
  }

  // ---------- URL (filtros y visor enlazables) ----------
  function guardarUrl() {
    const p = new URLSearchParams();
    if (state.cat) p.set('cat', state.cat);
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'new') p.set('sort', state.sort);
    const v = $('#viewer');
    if (v.open && state.list[state.idx]) p.set('img', state.list[state.idx].p.slice(4));
    const s = p.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }
  function leerUrl() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.cat = p.get('cat') || '';
    state.q = p.get('q') || '';
    state.sort = ['az', 'rand'].includes(p.get('sort')) ? p.get('sort') : 'new';
    return p.get('img');
  }

  // ---------- Idioma y tema ----------
  function textos() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    $('#lang').textContent = lang === 'es' ? 'EN' : 'ES';
  }
  function iconoTema() {
    $('#theme').textContent = document.documentElement.dataset.theme === 'light' ? '☾' : '☀';
  }

  // ---------- Arranque ----------
  async function init() {
    textos();
    iconoTema();
    const imgUrl = leerUrl();
    $('#status').textContent = t('loading');

    $('#lang').onclick = () => { lang = lang === 'es' ? 'en' : 'es'; store.set('ga_lang', lang); textos(); aplicar(); };
    $('#theme').onclick = () => {
      const n = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = n;
      store.set('ga_theme', n);
      iconoTema();
    };
    let qT;
    $('#q').oninput = (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value.trim(); aplicar(); }, 150); };
    $('#sort').onchange = (e) => { state.sort = e.target.value; state.seed = Math.random(); aplicar(); };
    $('#grid').onclick = (e) => { const c = e.target.closest('.card'); if (c) abrir(+c.dataset.k); };

    const v = $('#viewer');
    v.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const cp = e.target.closest('[data-copy]')?.dataset.copy;
      if (act === 'close' || e.target.classList.contains('v-stage')) cerrar();
      else if (act === 'prev') mover(-1);
      else if (act === 'next') mover(1);
      else if (cp) copiar(cp);
    });
    v.addEventListener('close', guardarUrl);
    document.addEventListener('keydown', (e) => {
      if (!v.open) {
        if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); }
        return;
      }
      if (e.key === 'ArrowLeft') mover(-1);
      else if (e.key === 'ArrowRight') mover(1);
    });
    let x0 = null;
    v.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    v.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
      x0 = null;
    });

    new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting && state.shown < state.list.length) pintarMas();
    }, { rootMargin: '800px' }).observe($('#more'));

    try {
      const { images, fallback } = await cargar();
      state.fallbackMsg = fallback;
      state.all = images.map((i) => ({ ...i, _busca: sinTildes(i.n + ' ' + i.c + ' ' + catLabel(i.c)).replace(/-/g, ' ') }));
    } catch (e) {
      $('#status').textContent = t('error');
      return;
    }
    desdeUrl(imgUrl);
    // Un enlace con otro # en la misma pestaña no recarga la página: se reaplica.
    window.addEventListener('hashchange', () => desdeUrl(leerUrl()));
  }

  function desdeUrl(imgUrl) {
    if (state.cat && !state.all.some((i) => i.c === state.cat)) state.cat = '';
    $('#q').value = state.q;
    $('#sort').value = state.sort;
    const v = $('#viewer');
    if (v.open) v.close();
    aplicar();
    if (imgUrl) {
      const k = state.list.findIndex((i) => i.p === 'img/' + imgUrl);
      if (k >= 0) { while (k >= state.shown) pintarMas(); abrir(k); }
    }
  }

  init();
})();
