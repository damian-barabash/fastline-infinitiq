/* Karty produktów w hero budowane z katalogu (`landing_products` — publiczny widok
   na `audit_catalog`, bez cen). W markupie zostaje statyczny snapshot: to on idzie
   do SSG, więc boty i czytniki bez JS widzą pełną ofertę, a strona ma co pokazać,
   gdy baza milczy. Po wczytaniu katalogu karty przebudowujemy w locie.

   Ukrycie produktu w hero (`landing_hidden`) to WYŁĄCZNIE warstwa wizualna —
   widok już takich nie zwraca, a audyt nadal je proponuje, bo patrzy na `hidden`. */

import { iconSvgHtml } from './productIcons.js';

const GROUPS = ['a', 'b', 'c', 'd'];

/* Produkty, które mają własną stronę (LP). Dopasowanie PO NAZWIE — numery
   katalogowe zmieniają się przy każdej rewizji oferty. Pierwsza taka strona
   jest zbiorcza: czterej agenci prowadzą na jeden adres. */
const PRODUCT_PAGES = [
  { re: /sprzedawc/i, href: '/agenci-ai' },
  { re: /doradc/i, href: '/agenci-ai' },
  { re: /asystent/i, href: '/agenci-ai' },
  { re: /recepcj/i, href: '/agenci-ai' },
];

/** Adres strony produktu albo '' — wtedy karta prowadzi do sekcji audytu. */
export function productHref(name) {
  const n = String(name || '');
  const hit = PRODUCT_PAGES.find((p) => p.re.test(n));
  return hit ? hit.href : '';
}
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const pad = (n) => ('0' + n).slice(-2);

/**
 * Przebudowuje `.pl-nodes` i podpisy grup z wierszy katalogu.
 * @param {Array<{id:number,name:string,descr:string,grp:string,group_name:string,ord:number}>} rows
 * @returns {boolean} czy DOM został zmieniony (false = zostaje snapshot z markupu)
 */
export function renderHeroProducts(rows) {
  const box = document.getElementById('plNodes');
  if (!box || !Array.isArray(rows) || !rows.length) return false;

  // Grupujemy same siebie, zamiast ufać kolejności z REST: sortowanie po `ord`
  // musi działać w obrębie grupy, a nie globalnie (grupy stoją w osobnych ćwiartkach).
  const byGroup = {};
  for (const r of rows) {
    const g = String(r.grp || '').toLowerCase();
    if (!GROUPS.includes(g) || !r.name) continue;
    (byGroup[g] = byGroup[g] || []).push(r);
  }
  const used = GROUPS.filter((g) => byGroup[g] && byGroup[g].length);
  if (!used.length) return false;                    // sam katalog bez grup A–D — zostaje snapshot

  let html = '', i = 0;
  for (const g of GROUPS) {
    const list = (byGroup[g] || []).slice().sort((a, b) => (a.ord ?? a.id) - (b.ord ?? b.id));
    for (const r of list) {
      const desc = r.descr ? `<i class="pl-desc">${esc(r.descr)}</i>` : '';
      const href = productHref(r.name);
      // produkt ze stroną = prawdziwy <a> (bot widzi link, `data-wipe` daje przejście
      // z kurtyną); reszta zostaje przyciskiem prowadzącym do sekcji audytu
      const open = href
        ? `<a class="pl-node has-page" href="${href}" data-wipe data-g="${g}" data-i="${i}" data-pid="${r.id}">`
        : `<div class="pl-node" role="button" tabindex="0" data-goto="1" data-g="${g}" data-i="${i}" data-pid="${r.id}">`;
      const go = href ? '<i class="pl-go" aria-hidden="true">→</i>' : '';
      html += open
        + `<div class="pl-top">${iconSvgHtml(r.name, r.id)}<span class="pl-num">${pad(i + 1)}</span>${go}</div>`
        + `<b class="pl-name">${esc(r.name)}</b>${desc}${href ? '</a>' : '</div>'}`;
      i++;
    }
  }
  box.innerHTML = html;

  // Podpisy ćwiartek biorą nazwę grupy z katalogu — dzięki temu zmiana nazwy grupy
  // przy produkcie przekłada się na hero bez drugiego miejsca do edycji.
  document.querySelectorAll('.pl-gname[data-g]').forEach((el) => {
    const g = el.dataset.g;
    const first = (byGroup[g] || [])[0];
    if (first && first.group_name) el.textContent = first.group_name;
    // grupa bez widocznych produktów: podpis zostaje, ale nie ma czego pokazać
    el.classList.toggle('empty', !(byGroup[g] && byGroup[g].length));
  });

  return true;
}

/** Adres publicznego widoku katalogu (używa go lądowanie i podgląd w edytorze). */
export const LANDING_PRODUCTS_QUERY = 'landing_products?select=id,name,descr,grp,group_name,ord&order=ord.asc';
