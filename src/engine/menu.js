/* Pełnoekranowe menu spod burgera (zastąpiło pasek sekcji po prawej).
   Pozycje sekcji budujemy z FAKTYCZNYCH grani strony — na lądowaniu CMS potrafi
   ukryć grań, a wtedy numeracja z markupu byłaby nieprawdziwa. Nazwy bierzemy
   z ukrytego railu (jedno miejsce z podpisami) albo z `data-title` sekcji. */

export function initMenu({ signal, goTo } = {}) {
  const btn = document.getElementById('menuBtn');
  const overlay = document.getElementById('fiqMenu');
  if (!btn || !overlay) return () => {};

  const box = overlay.querySelector('#menuSections');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const railNames = Array.from(document.querySelectorAll('.rail-item .rail-name')).map((n) => n.textContent.trim());

  if (box) {
    box.innerHTML = '';
    slides.forEach((s, i) => {
      const label = railNames[i] || s.dataset.title || s.id;
      const b = document.createElement('button');
      b.className = 'menu-link';
      b.type = 'button';
      b.innerHTML = `<span class="menu-num">${String(i + 1).padStart(2, '0')}</span><span>${label}</span>`;
      b.addEventListener('click', () => { close(); if (goTo) goTo(i); }, { signal });
      box.appendChild(b);
    });
  }

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
    // клик по фону или по любой ссылке внутри — закрываем (переход делает wipe)
    if (e.target === overlay || e.target.closest('a, .menu-close')) close();
  }, { signal });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal });

  return () => { setOpen(false); document.documentElement.classList.remove('menu-open'); };
}
