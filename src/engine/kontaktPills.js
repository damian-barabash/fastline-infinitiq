/* Pilulki „Które rozwiązania Cię interesują?" na /kontakt = NASZ katalog produktów.

   Ta sama lista, co w menu pod burgerem (widok `landing_products`, czyli produkty
   nieukryte w katalogu) i ta sama, z której liczy się audyt — więc nowy produkt
   pojawia się w formularzu sam, bez dotykania kodu. Duplikaty nazw znikają
   (ten sam „AI Sprzedawca" stoi w katalogu w dwóch grupach), produkty z własną
   stroną idą na górę — dokładnie jak w menu.

   Markup w `KontaktShell.jsx` zostaje snapshotem dla SSG i fallbackiem, gdy baza
   milczy. Ostatnia pilulka („Nie wiem jeszcze") jest zawsze dopisywana na końcu:
   to najczęstsza odpowiedź klienta, który dopiero pyta. */

import { productHref } from './heroProducts.js';

const UNSURE = 'Nie wiem jeszcze';
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

export function renderKontaktPills(rows) {
  const box = document.getElementById('pills');
  if (!box || !Array.isArray(rows) || !rows.length) return false;

  const seen = new Set();
  const uniq = [];
  rows.forEach((r) => {
    const k = norm(r.name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    uniq.push(r);
  });
  const ready = uniq.filter((r) => productHref(r.name));
  const rest = uniq.filter((r) => !productHref(r.name));
  const names = ready.concat(rest).map((r) => r.name);
  names.push(UNSURE);

  box.innerHTML = '';
  names.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill' + (name !== UNSURE && productHref(name) ? ' ready' : '');
    b.setAttribute('data-topic', name);
    b.textContent = name;
    box.appendChild(b);
  });
  return true;
}
