/* Mobilny hero (≤640 px, 2026-10-28): zakładki grup z ikonami + karty produktów
   + kula z punktów jako dekoracja w tle — kopuła nad zakładkami, dolna połowa
   schowana pod paskiem zakładek i kartami (mają pełne tło).

   Dane bierzemy z kart kuli (`#plNodes .pl-node`) — to ten sam DOM, który
   zbudował katalog (albo snapshot SSG), więc nie ma drugiego źródła produktów.
   Po przebudowie kart z katalogu Home.jsx wywołuje init jeszcze raz.

   Układ zakładki: pierwsza karta szeroka (produkt w sprzedaży świeci kwasem,
   reszta szara „Wkrótce"), dalej siatka 2 kolumn, nieparzysta ostatnia = wiersz. */

import { groupSvgHtml } from './productIcons.js';
import { renderDpr, skipFrame } from './perf.js';

const MQ = '(max-width: 640px)';
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readProducts() {
  return Array.from(document.querySelectorAll('#plNodes .pl-node')).map((n) => ({
    g: n.dataset.g,
    name: (n.querySelector('.pl-name') || {}).textContent || '',
    desc: (n.querySelector('.pl-desc') || {}).textContent || '',
    href: n.tagName === 'A' ? n.getAttribute('href') : '',
    icon: (n.querySelector('.pl-ic') || {}).outerHTML || '',
  })).filter((p) => p.g && p.name.trim());
}

function groupNames() {
  const out = {};
  document.querySelectorAll('.pl-gname[data-g]').forEach((el) => {
    const full = el.textContent.trim();
    // zakładka ma ~80 px — wystarcza pierwsze słowo („Obsługa klienta" → „Obsługa")
    out[el.dataset.g] = { full, short: full.split(/\s+/)[0] || full };
  });
  return out;
}

function card(p, kind) {
  const live = !!p.href;
  const tag = live ? 'a' : 'div';
  const attrs = live ? ` href="${esc(p.href)}" data-wipe` : ' aria-disabled="true"';
  const cls = `mh-card ${kind}${live ? ' live' : ' locked'}`;
  const cap = kind === 'wide'
    ? `<span class="mh-cap">${live ? 'Dostępny od dziś' : 'Wkrótce w sprzedaży'}</span>`
    : (live ? '' : '<span class="mh-soon">Wkrótce</span>');
  const go = live ? '<span class="mh-go" aria-hidden="true">↗</span>' : '';
  return `<${tag} class="${cls}"${attrs}>`
    + `<div class="mh-top">${kind === 'wide' ? cap : p.icon}${kind === 'wide' ? go : (live ? go : cap)}</div>`
    + `<b class="mh-name">${esc(p.name.trim())}</b>`
    + (p.desc ? `<i class="mh-desc">${esc(p.desc.trim())}</i>` : '')
    + `</${tag}>`;
}

function row(p) {
  const live = !!p.href;
  const tag = live ? 'a' : 'div';
  const attrs = live ? ` href="${esc(p.href)}" data-wipe` : ' aria-disabled="true"';
  return `<${tag} class="mh-card row${live ? ' live' : ' locked'}"${attrs}>${p.icon}`
    + `<span class="mh-rowt"><b class="mh-name">${esc(p.name.trim())}</b>`
    + (p.desc ? `<i class="mh-desc">${esc(p.desc.trim())}</i>` : '') + '</span>'
    + `<span class="mh-chev" aria-hidden="true">${live ? '›' : ''}</span></${tag}>`;
}

export function initHeroMobile() {
  const box = document.getElementById('mHero');
  if (!box) return () => {};
  const ac = new AbortController();
  const { signal } = ac;

  const products = readProducts();
  const names = groupNames();
  const groups = ['b', 'c', 'a', 'd'].filter((g) => products.some((p) => p.g === g));
  if (!groups.length) { box.hidden = true; return () => {}; }
  box.hidden = false;
  // start na grupie z produktem w sprzedaży — klient od razu widzi, co kupi
  const liveG = (products.find((p) => p.href) || {}).g;
  let active = groups.includes(liveG) ? liveG : groups[0];

  const tabs = box.querySelector('.mh-tabs');
  const list = box.querySelector('.mh-cards');

  function renderTabs() {
    tabs.innerHTML = groups.map((g) => {
      const n = names[g] || { full: g.toUpperCase(), short: g.toUpperCase() };
      return `<button type="button" class="mh-tab${g === active ? ' on' : ''}" data-g="${g}" role="tab"`
        + ` aria-selected="${g === active}" aria-label="${esc(n.full)}">${groupSvgHtml(g, 20)}<span>${esc(n.short)}</span></button>`;
    }).join('');
  }

  function renderCards() {
    const items = products.filter((p) => p.g === active);
    // produkt w sprzedaży zawsze pierwszy (szeroki)
    items.sort((a, b) => (b.href ? 1 : 0) - (a.href ? 1 : 0));
    const [first, ...rest] = items;
    let html = first ? card(first, 'wide') : '';
    const pairs = rest.length % 2 ? rest.slice(0, -1) : rest;
    if (pairs.length) html += '<div class="mh-grid">' + pairs.map((p) => card(p, 'tile')).join('') + '</div>';
    if (rest.length % 2) html += row(rest[rest.length - 1]);
    list.innerHTML = html;
    list.classList.remove('in');
    void list.offsetWidth;   // restart animacji wejścia
    list.classList.add('in');
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.mh-tab');
    if (!b || b.dataset.g === active) return;
    active = b.dataset.g;
    renderTabs();
    renderCards();
  }, { signal });

  renderTabs();
  renderCards();

  /* ---- kula w tle ---- */
  const cv = box.querySelector('.mh-sphere');
  const ctx = cv && cv.getContext('2d');
  const mq = matchMedia(MQ);
  let raf = 0, visible = false, W = 0, H = 0, dpr = 1, pts = [];

  function build() {
    const N = 900;
    pts = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996323;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
  }
  function size() {
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    dpr = renderDpr(1.5);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function draw(now) {
    raf = 0;
    if (!visible || !mq.matches || document.hidden) return;
    raf = requestAnimationFrame(draw);
    if (skipFrame(now, 'mhero')) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const R = W * 0.44, cx = W / 2, cy = H;          // środek kuli na dolnej krawędzi = widać kopułę
    const rot = now * 0.00012, tilt = -0.32;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    ctx.fillStyle = '#B8FF00';
    for (const [x0, y0, z0] of pts) {
      const x = x0 * cr + z0 * sr;
      const z1 = -x0 * sr + z0 * cr;
      const y = y0 * ct - z1 * st;
      const z = y0 * st + z1 * ct;
      const py = cy - y * R;
      if (py > H + 2) continue;
      const k = (z + 1) / 2;                           // 0 tył … 1 przód
      ctx.globalAlpha = 0.08 + k * 0.62;
      const s = 0.7 + k * 1.3;
      ctx.fillRect(cx + x * R - s / 2, py - s / 2, s, s);
    }
    // równik i łuk — ten sam język co kula na desktopie
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#B8FF00';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.16, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const kick = () => { if (!raf && visible && mq.matches) raf = requestAnimationFrame(draw); };

  if (cv && ctx) {
    build();
    size();
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); });
    io.observe(cv);
    addEventListener('resize', () => { size(); kick(); }, { signal });
    mq.addEventListener('change', () => { size(); kick(); }, { signal });
    document.addEventListener('visibilitychange', kick, { signal });
    signal.addEventListener('abort', () => io.disconnect());
  }

  return () => { ac.abort(); if (raf) cancelAnimationFrame(raf); };
}
