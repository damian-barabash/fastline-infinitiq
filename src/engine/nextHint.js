/* „↓ <następna sekcja> ↓" — plakietka na dole okna, na każdej stronie z sekcjami
   (`.slide`). Od 2026-10-14 bez słowa „Dalej": sama nazwa następnego bloku
   i strzałki po obu stronach (właściciel).

   Nazwa = tekst `.section-label` następnej sekcji (CMS) bez numeru, awaryjnie
   nazwa z railu albo id. Znika od razu przy przewijaniu (`.moving`), wraca po
   zatrzymaniu; w ostatniej sekcji jej nie ma (`.end`), w długiej sekcji pokazuje
   się dopiero przy jej końcu. Klik przewija do następnej sekcji.

   Strona może mieć `#nextHint` w markupie (SSG); jeśli nie ma — moduł dokłada
   go sam do <body> i zdejmuje przy sprzątaniu. */

const ARROW = '<svg class="nh-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15M5.5 12.5 12 19l6.5-6.5"/></svg>';

export function initNextHint({ slides, goTo, small, signal }) {
  let el = document.getElementById('nextHint');
  let own = false;
  if (!el) {
    el = document.createElement('button');
    el.type = 'button';
    el.id = 'nextHint';
    el.className = 'next-hint';
    el.setAttribute('aria-label', 'Następna sekcja');
    el.innerHTML = `${ARROW}<span class="nh-name" data-next></span>${ARROW}`;
    document.body.appendChild(el);
    own = true;
  }
  const nameEl = el.querySelector('[data-next]');
  const railNames = Array.from(document.querySelectorAll('.rail-item'))
    .map((b) => ((b.querySelector('.rail-name') || {}).textContent || '').trim());
  const secName = (i) => {
    const raw = ((slides[i].querySelector('.section-label') || {}).textContent || '').trim();
    return raw.replace(/^(\/\/|\d+\s*[—–-])\s*/, '').replace(/\s+/g, ' ') || railNames[i] || slides[i].id;
  };

  let active = 0;
  function update(idx) {
    if (typeof idx === 'number') active = idx;
    const last = active >= slides.length - 1;
    // Plakietka pojawia się dopiero przy KOŃCU bloku (dół sekcji blisko dołu okna)
    // albo gdy blok mieści się w oknie — w środku długiej sekcji zasłaniała tekst
    // i karty (audyt UX 2026-10-14). Czytamy jeden prostokąt, tylko po zatrzymaniu.
    const r = slides[active] ? slides[active].getBoundingClientRect() : null;
    const atEnd = !r || r.height <= innerHeight * 1.1 || r.bottom <= innerHeight * 1.15;
    el.classList.toggle('end', last || !atEnd);
    // ostatnia sekcja ma stopkę na dole okna — licznik „07 / 07" wchodził na nią
    document.documentElement.classList.toggle('fiq-last', last);
    if (!last && nameEl) {
      const name = secName(active + 1);
      if (nameEl.textContent !== name) nameEl.textContent = name;
    }
  }

  let stopT = 0;
  addEventListener('scroll', () => {
    if (!el.classList.contains('moving')) el.classList.add('moving');
    clearTimeout(stopT);
    stopT = setTimeout(() => { el.classList.remove('moving'); update(); }, 280);
  }, { passive: true, signal });
  el.addEventListener('click', () => goTo(active + 1), { signal });
  addEventListener('fiq:content-ready', () => update(), { signal }); // CMS mógł zmienić nazwy sekcji
  update(0);

  return {
    update,
    destroy() { clearTimeout(stopT); document.documentElement.classList.remove('fiq-last'); if (own) el.remove(); },
  };
}
