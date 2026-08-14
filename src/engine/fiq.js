// ===== FIQ: общий модуль структурного CMS (рендер блоков, builders, applyContent).
// Логика перенесена 1:1 из index.html/editor.html (там держалась побайтово идентичной).
export function ensureFIQ() {
  if (typeof window === 'undefined') return null;
  if (window.FIQ && window.FIQ.applyContent) return window.FIQ;

  const FIQ = window.FIQ = window.FIQ || {};
  const PH = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%231A1A1A'/%3E%3Crect x='1' y='1' width='398' height='298' fill='none' stroke='%23B8FF00' stroke-opacity='0.25'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' font-family='monospace' font-size='15' text-anchor='middle' dominant-baseline='middle'%3E%2B zdjecie%3C/text%3E%3C/svg%3E";
  const esc = FIQ.esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const attr = FIQ.attr = s => String(s == null ? '' : s).replace(/"/g, '&quot;');
  const pad = n => ('0' + n).slice(-2);
  const img = (src, field) => `<img data-fimg="${field}" src="${src ? attr(src) : PH}" alt="">`;

  /* ===== 9 шаблонов блоков ===== */
  const B = FIQ.BLOCKS = {
    partners: {
      label: 'Partnerzy / logo',
      make: () => ({ eyebrow: 'Partnerzy', title: 'Zaufali nam', items: [{ img: '' }, { img: '' }, { img: '' }, { img: '' }] }),
      item: it => `<div class="fb-item fb-logo">${img(it.img, 'img')}</div>`,
      render(d) { return `<div class="fb fb-partners" data-block-type="partners"><div class="fb-eyebrow" data-f="eyebrow">${esc(d.eyebrow || '')}</div><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><div class="fb-grid fb-logos" data-items="items">${(d.items || []).map(this.item).join('')}</div></div>`; }
    },
    gallery: {
      label: 'Galeria zdjęć',
      make: () => ({ title: 'Galeria', items: [{ img: '', cap: 'Podpis' }, { img: '', cap: 'Podpis' }, { img: '', cap: 'Podpis' }] }),
      item: it => `<figure class="fb-item fb-figure">${img(it.img, 'img')}<figcaption class="fb-cap" data-f="cap">${esc(it.cap || '')}</figcaption></figure>`,
      render(d) { return `<div class="fb fb-gallery-w" data-block-type="gallery"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><div class="fb-grid fb-gallery" data-items="items">${(d.items || []).map(this.item).join('')}</div></div>`; }
    },
    textimg: {
      label: 'Tekst + zdjęcie',
      make: () => ({ title: 'Nagłówek sekcji', text: 'Krótki opis tej sekcji. Kliknij, aby edytować.', img: '', flip: false }),
      render(d) { return `<div class="fb fb-textimg" data-block-type="textimg" data-flip="${d.flip ? '1' : '0'}"><div class="fb-split${d.flip ? ' fb-flip' : ''}"><div class="fb-split-text"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><p class="fb-p" data-f="text">${esc(d.text || '')}</p></div><div class="fb-split-media">${img(d.img, 'img')}</div></div></div>`; }
    },
    stats: {
      label: 'Statystyki',
      make: () => ({ title: 'W liczbach', items: [{ num: '16/16', label: 'Etykieta', desc: 'Krótki opis liczby.' }, { num: 'ROI', label: 'Etykieta', desc: 'Krótki opis liczby.' }, { num: '25 lat', label: 'Etykieta', desc: 'Krótki opis liczby.' }] }),
      item: it => `<div class="fb-item fb-stat"><div class="fb-stat-num" data-f="num">${esc(it.num || '')}</div><div class="fb-stat-label" data-f="label">${esc(it.label || '')}</div><div class="fb-stat-desc" data-f="desc">${esc(it.desc || '')}</div></div>`,
      render(d) { return `<div class="fb fb-stats-w" data-block-type="stats"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><div class="fb-grid fb-stats" data-items="items">${(d.items || []).map(this.item).join('')}</div></div>`; }
    },
    cards: {
      label: 'Karty z numerami',
      make: () => ({ title: 'Co robimy', items: [{ h: 'Tytuł karty', p: 'Opis karty.' }, { h: 'Tytuł karty', p: 'Opis karty.' }, { h: 'Tytuł karty', p: 'Opis karty.' }] }),
      item: (it, i) => `<div class="fb-item fb-card"><div class="fb-card-num">${pad(i + 1)}</div><h3 data-f="h">${esc(it.h || '')}</h3><p data-f="p">${esc(it.p || '')}</p></div>`,
      render(d) { return `<div class="fb fb-cards-w" data-block-type="cards"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><div class="fb-grid fb-cards" data-items="items">${(d.items || []).map(this.item).join('')}</div></div>`; }
    },
    quote: {
      label: 'Cytat / referencja',
      make: () => ({ text: '„Tu trafia cytat lub opinia klienta."', author: 'Imię Nazwisko', role: 'Stanowisko, Firma', img: '' }),
      render(d) { return `<div class="fb fb-quote-w" data-block-type="quote"><blockquote class="fb-quote"><div class="fb-quote-text" data-f="text">${esc(d.text || '')}</div><div class="fb-quote-meta">${img(d.img, 'img')}<div><div class="fb-quote-author" data-f="author">${esc(d.author || '')}</div><div class="fb-quote-role" data-f="role">${esc(d.role || '')}</div></div></div></blockquote></div>`; }
    },
    cta: {
      label: 'CTA — baner',
      make: () => ({ title: 'Gotowi na start?', text: 'Krótkie wezwanie do działania.', btn: 'Umów rozmowę', href: '/kontakt' }),
      render(d) { return `<div class="fb fb-cta-w" data-block-type="cta"><div class="fb-cta"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><p class="fb-p" data-f="text">${esc(d.text || '')}</p><a class="fb-cta-btn" href="${attr(d.href || '#')}" data-f="btn">${esc(d.btn || '')}</a><span class="fb-href-edit" data-f="href">${esc(d.href || '')}</span></div></div>`; }
    },
    logotext: {
      label: 'Logo + opis',
      make: () => ({ img: '', text: 'Tekst opisu — kliknij, aby edytować.' }),
      render(d) { return `<div class="fb fb-logotext" data-block-type="logotext">${img(d.img, 'img')}<p class="fb-p" data-f="text">${esc(d.text || '')}</p></div>`; }
    },
    steps: {
      label: 'Proces / kroki',
      make: () => ({ title: 'Jak pracujemy', items: [{ h: 'Krok', p: 'Opis kroku.' }, { h: 'Krok', p: 'Opis kroku.' }, { h: 'Krok', p: 'Opis kroku.' }] }),
      item: (it, i) => `<div class="fb-item fb-step"><div class="fb-step-num">${pad(i + 1)}</div><div><h3 data-f="h">${esc(it.h || '')}</h3><p data-f="p">${esc(it.p || '')}</p></div></div>`,
      render(d) { return `<div class="fb fb-steps-w" data-block-type="steps"><h3 class="fb-h" data-f="title">${esc(d.title || '')}</h3><div class="fb-steps" data-items="items">${(d.items || []).map(this.item).join('')}</div></div>`; }
    }
  };
  FIQ.renderBlock = (type, d) => { const t = B[type]; return t ? t.render(d || {}) : ''; };

  /* ===== Builders для повторяемых списков (svc, who) ===== */
  // Дефолтные продукты/подписи фаз (по стабильному demo-ключу строки) —
  // применяются, пока в CMS у строки нет своих chips/foot; первый Zapisz
  // редактора сохранит их в _lists и дальше они правятся как обычный текст.
  const SVC_DEFAULTS = FIQ.SVC_DEFAULTS = {
    strategy: { chips: 'Market Radar | analiza rynku; Benchmarks | benchmarki; Rival Map | konkurencja; ICP Decode | analiza TG', foot: 'Czego klasyczna agencja nie robi w ogóle.' },
    gen: { chips: 'Offer Design | strategia produktu; Brand Core | platforma marki; Comms Engine | komunikacja; Funnel Design | lejek', foot: 'Tu rodzi się lejek i obietnica marki.' },
    voice: { chips: 'Creative Lab | kreacja; Launch Line | realizacja; Lead Engine | leady i sprzedaż', foot: 'Jedyny obszar pokrywany przez starą agencję.' },
    llm: { chips: 'Live Ops | optymalizacja na żywo; ROI Radar | wydatek → przychód; Sales Assist | wsparcie handlowców', foot: 'Serce modelu — tu bierzemy odpowiedzialność za wynik.' },
    auto: { chips: 'Loyalty Loop | retencja i lojalność; LTV Boost | wartość klienta w czasie', foot: 'Prawa strona lejka: wynik się utrzymuje i rośnie.' }
  };
  // «Market Radar | analiza rynku; Benchmarks | benchmarki» → [{n,c},…]
  const parseChips = FIQ.parseChips = s => String(s == null ? '' : s)
    .split(';').map(t => t.trim()).filter(Boolean)
    .map(t => { const p = t.split('|'); return { n: (p[0] || '').trim(), c: (p[1] || '').trim() }; });
  FIQ.buildSvcRow = (it, i) => {
    const name = it.name || '';
    const sp = name.indexOf(' ');
    const title = sp > 0 ? name.slice(0, sp) : name;   // первое слово = крупный титул
    const cap = sp > 0 ? name.slice(sp + 1) : '';      // остальное = mono-подпись
    const def = SVC_DEFAULTS[it.demo] || {};
    const chipsRaw = (it.chips != null && it.chips !== '') ? it.chips : (def.chips || '');
    const foot = (it.foot != null && it.foot !== '') ? it.foot : (def.foot || '');
    const chips = parseChips(chipsRaw).map(c =>
      `<span class="svc-chip"><b>${esc(c.n)}</b>${c.c ? `<i>${esc(c.c)}</i>` : ''}</span>`).join('');
    return `<div class="svc-row" data-litem data-demo="${attr(it.demo || '')}" style="--i:${i}">`
      + `<div class="svc-main"><div class="svc-top"><span class="svc-num">${pad(i + 1)}</span>`
      + `<span class="svc-title">${esc(title)}</span><span class="svc-cap">${esc(cap)}</span>`
      + `<span class="svc-name" data-f="name">${esc(name)}</span></div>`
      + `<p class="svc-desc" data-f="desc">${esc(it.desc || '')}</p>`
      + `<div class="svc-foot" data-f="foot">${esc(foot)}</div></div>`
      + `<div class="svc-side"><span class="svc-chips-src" data-f="chips">${esc(chipsRaw)}</span>`
      + `<div class="svc-chips" aria-hidden="true">${chips}</div></div>`
      + `<span class="svc-beam" aria-hidden="true"></span></div>`;
  };
  // WHO v2: первый элемент списка = hero-карточка «главная специализация»
  // (CTA + стат-боксы Cel/Mierzymy + спарклайн pipeline), остальные — карточки категорий.
  FIQ.buildWhoCard = (it, i) => {
    const tag = `<div class="who-tag" data-f="tag">${esc(it.tag || '')}</div>`;
    if (i === 0) {
      return `<div class="who-item who-hero" data-litem data-n="01">`
        + `<div class="wh-main">${tag}<h3 data-f="h">${esc(it.h || '')}</h3><p data-f="p">${esc(it.p || '')}</p>`
        + `<a class="wh-cta" href="/kontakt" data-wipe data-f="cta">${esc(it.cta || '')}</a></div>`
        + `<div class="wh-stats">`
        + `<div class="wh-stat"><div class="wh-stat-l" data-f="s1l">${esc(it.s1l || '')}</div><div class="wh-stat-v"><span data-f="s1v">${esc(it.s1v || '')}</span><canvas class="wh-spark" aria-hidden="true"></canvas></div></div>`
        + `<div class="wh-stat"><div class="wh-stat-l" data-f="s2l">${esc(it.s2l || '')}</div><div class="wh-stat-v"><span data-f="s2v">${esc(it.s2v || '')}</span></div></div>`
        + `</div></div>`;
    }
    return `<div class="who-item" data-litem data-n="${pad(i + 1)}">${tag}<h3 data-f="h">${esc(it.h || '')}</h3><p data-f="p">${esc(it.p || '')}</p></div>`;
  };
  const LIST_BUILD = { svc: FIQ.buildSvcRow, who: FIQ.buildWhoCard };

  /* ===== Зоны для блоков в каждой секции ===== */
  FIQ.ensureZones = () => {
    document.querySelectorAll('.slide[id]').forEach(s => {
      const inner = s.querySelector('.slide-inner');
      if (!inner || inner.querySelector(':scope > .fiq-blocks')) return;
      const z = document.createElement('div');
      z.className = 'fiq-blocks';
      z.setAttribute('data-zone', s.id);
      inner.appendChild(z);
    });
  };

  /* ===== Применение контента: flat-ключи + _lists + _hidden + _blocks =====
     opts.editor=true → скрытые элементы остаются видны (с классом fiq-hidden) для управления. */
  FIQ.applyContent = (content, opts) => {
    opts = opts || {};
    const ed = !!opts.editor;
    content = (content && typeof content === 'object') ? content : {};

    // 1. Плоские ключи
    document.querySelectorAll('[data-edit]').forEach(el => {
      const k = el.getAttribute('data-edit');
      if (k[0] === '_' || !(k in content)) return;
      const v = content[k]; if (v == null) return;
      const t = el.getAttribute('data-edit-type');
      if (t === 'image') { if (el.tagName === 'IMG' && v) el.src = v; }
      else if (t === 'html') el.innerHTML = v;
      else el.textContent = v;
    });

    // 2. Повторяемые списки
    const lists = content._lists || {};
    document.querySelectorAll('[data-list]').forEach(cont => {
      const name = cont.getAttribute('data-list');
      const arr = lists[name];
      const build = LIST_BUILD[name];
      if (!Array.isArray(arr) || !build) return;
      let html = '', n = 0;
      arr.forEach(it => {
        const hidden = it && it.hidden;
        if (hidden && !ed) return;
        n++; html += build(it, n - 1);
      });
      cont.innerHTML = html;
      if (ed) {
        const kids = cont.children;
        for (let i = 0; i < arr.length && i < kids.length; i++)
          if (arr[i] && arr[i].hidden) kids[i].classList.add('fiq-hidden');
      }
    });

    // 3. Скрываемые одиночные элементы
    const hidden = new Set(content._hidden || []);
    document.querySelectorAll('[data-hideable]').forEach(el => {
      const isH = hidden.has(el.getAttribute('data-hideable'));
      if (ed) { el.classList.toggle('fiq-hidden', isH); el.style.display = ''; }
      else el.style.display = isH ? 'none' : '';
    });

    // 4. Вставленные блоки
    FIQ.ensureZones();
    const blocks = content._blocks || {};
    document.querySelectorAll('[data-zone]').forEach(zone => {
      const arr = blocks[zone.getAttribute('data-zone')];
      if (!Array.isArray(arr)) { zone.innerHTML = ''; return; }
      let html = '';
      const shown = [];
      arr.forEach(b => {
        if (!b || !b.type) return;
        if (b.hidden && !ed) return;
        html += FIQ.renderBlock(b.type, b.data || {});
        shown.push(b);
      });
      zone.innerHTML = html;
      if (ed) {
        const kids = zone.children;
        for (let i = 0; i < shown.length && i < kids.length; i++)
          if (shown[i].hidden) kids[i].classList.add('fiq-hidden');
      }
    });
  };

  return FIQ;
}
