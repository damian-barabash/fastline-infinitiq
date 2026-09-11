/* Pełnoekranowe menu spod burgera (zastąpiło pasek sekcji po prawej).

   Lewa kolumna — sekcje BIEŻĄCEJ strony. Nazwy bierzemy z etykiet sekcji
   (`.section-label`, np. „02 — Dlaczego inaczej?”), bo te edytuje się w CMS;
   numer i myślnik obcinamy, numeruje samo menu. Pierwsza pozycja to zawsze
   stała „Home”. Gdy sekcja nie ma etykiety, wracamy do podpisu z (ukrytego)
   railu — jedno miejsce z zapasowymi nazwami.

   Prawa kolumna — PRODUKTY z katalogu (`landing_products`). Produkt ze swoją
   stroną jest linkiem, reszta stoi na szaro: klient widzi pełną ofertę i to,
   co już ma osobną stronę. */

import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import { productHref } from './heroProducts.js';

const HOME_LABEL = 'Home';
const stripNum = (s) => String(s || '').replace(/^\s*\/*\s*\d+\s*[—–-]\s*/, '').replace(/^\s*\/\/\s*/, '').trim();

export function initMenu({ signal, goTo } = {}) {
  const btn = document.getElementById('menuBtn');
  const overlay = document.getElementById('fiqMenu');
  if (!btn || !overlay) return () => {};

  const box = overlay.querySelector('#menuSections');
  const prodBox = overlay.querySelector('#menuProducts');

  /* ---- sekcje ---- */
  function buildSections() {
    if (!box) return;
    // Strona z bębnem (lądowanie, /agenci-ai) ma granie `.slide`; strona zwykła
    // (/kontakt) — bloki `[data-msec]`. Wtedy zamiast `goTo` przewijamy do bloku.
    const slides = Array.from(document.querySelectorAll('.slide'));
    const drum = slides.length > 0;
    const secs = drum ? slides : Array.from(document.querySelectorAll('[data-msec]'));
    const railNames = Array.from(document.querySelectorAll('.rail-item .rail-name')).map((n) => n.textContent.trim());
    box.innerHTML = '';
    secs.forEach((s, i) => {
      const fromCms = stripNum((s.querySelector('.section-label') || {}).textContent || '');
      const label = i === 0 ? HOME_LABEL : (fromCms || (drum ? railNames[i] : s.dataset.msec) || s.dataset.title || s.id);
      const b = document.createElement('button');
      b.className = 'menu-link';
      b.type = 'button';
      b.innerHTML = `<span class="menu-num">${String(i + 1).padStart(2, '0')}</span><span></span>`;
      b.lastElementChild.textContent = label;
      b.addEventListener('click', () => {
        close();
        if (drum && goTo) { goTo(i); return; }
        if (i === 0) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
        s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, { signal });
      box.appendChild(b);
    });
  }

  /* ---- produkty ----
     Katalog bywa „szerszy” niż menu: ten sam produkt stoi w dwóch grupach
     (np. „AI Sprzedawca” w Sprzedaży i u Agentów) — w kuli to ma sens, w liście
     to zwykły duplikat, więc zostawiamy pierwsze wystąpienie nazwy.
     Gotowe strony idą na górę: klient najpierw widzi to, co może otworzyć. */
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  function prepare(rows) {
    const seen = new Set();
    const uniq = [];
    (rows || []).forEach((r) => {
      const k = norm(r.name);
      if (!k || seen.has(k)) return;
      seen.add(k);
      uniq.push(r);
    });
    const ready = uniq.filter((r) => productHref(r.name));
    const rest = uniq.filter((r) => !productHref(r.name));
    return ready.concat(rest);
  }

  function renderProducts(rows) {
    if (!prodBox) return;
    prodBox.innerHTML = '';
    prepare(rows).forEach((r) => {
      const href = productHref(r.name);
      const el = document.createElement(href ? 'a' : 'span');
      el.className = 'menu-link' + (href ? '' : ' off');
      if (href) { el.setAttribute('href', href); el.setAttribute('data-wipe', ''); }
      else el.title = 'Strona produktu w przygotowaniu';
      el.innerHTML = `<span class="menu-num">${href ? '→' : '·'}</span><span></span>`;
      el.lastElementChild.textContent = r.name;
      prodBox.appendChild(el);
    });
  }

  if (prodBox) {
    fetch(`${SB_URL}/rest/v1/landing_products?select=id,name,grp,ord&order=grp.asc,ord.asc`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => { if (rows && rows.length) renderProducts(rows); })
      .catch(() => { /* brak sieci — zostaje to, co w markupie */ });
  }

  buildSections();
  // CMS podmienia etykiety sekcji już po starcie silnika — przebudowujemy listę
  addEventListener('fiq:content-ready', () => setTimeout(buildSections, 0), { signal });

  let open = false;
  function setOpen(v) {
    if (v === open) return;
    open = v;
    overlay.classList.toggle('show', v);
    btn.classList.toggle('on', v);
    btn.setAttribute('aria-expanded', v ? 'true' : 'false');
    document.documentElement.classList.toggle('menu-open', v);
    if (v) overlay.removeAttribute('hidden');
    else setTimeout(() => { if (!open) overlay.setAttribute('hidden', ''); }, 420);
  }
  const close = () => setOpen(false);

  btn.addEventListener('click', () => setOpen(!open), { signal });
  overlay.addEventListener('click', (e) => {
    // klik w tło albo w dowolny link — zamykamy (przejście robi kurtyna)
    if (e.target === overlay || e.target.closest('a[href], .menu-close')) close();
  }, { signal });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal });

  return () => { setOpen(false); document.documentElement.classList.remove('menu-open'); };
}
