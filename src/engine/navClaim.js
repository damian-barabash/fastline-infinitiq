/* Claim pod logo w nagłówku: „Data driven. Mind created. Unique executed."
   Ma mieć szerokość logo × --nav-claim-k — a logo zmienia wysokość (nav.shrunk,
   media-query, podmiana obrazka z CMS), więc kegl liczy się z pomiaru,
   nie z tabelki wartości. Fallback dla SSG i edytora siedzi w CSS. */

const MIN_FS = 4.6;   // niżej claim przestaje być czytelny nawet jako znak graficzny
const MAX_FS = 13;
const GAP = 3;        // minimalny odstęp między frazami (space-between rozdaje resztę)

/** Dopasowuje szerokość i kegl claimu do aktualnej szerokości logo. */
export function fitNavClaim(root) {
  const scope = root || document;
  const brand = scope.querySelector('.nav-brand');
  if (!brand) return;
  const img = brand.querySelector('.nav-logo img');
  const claim = brand.querySelector('.nav-claim');
  if (!img || !claim) return;

  const logoW = img.getBoundingClientRect().width;
  if (!logoW) return; // obrazek jeszcze się nie wczytał — wywołamy ponownie z RO/load
  // krotność szerokości logo (CSS: --nav-claim-k) — na telefonie mniejsza
  const k = parseFloat(getComputedStyle(brand).getPropertyValue('--nav-claim-k')) || 1;
  const w = logoW * k;
  brand.style.setProperty('--nav-claim-w', w.toFixed(1) + 'px');

  const kids = Array.from(claim.children).filter((el) => el.getClientRects().length);
  if (!kids.length) return;
  const target = Math.max(24, w - GAP * (kids.length - 1));

  // separatory są w em, więc cała linia skaluje się proporcjonalnie:
  // dwa przebiegi wystarczą, żeby trafić w szerokość logo
  let fs = parseFloat(getComputedStyle(claim).fontSize) || 8;
  for (let pass = 0; pass < 2; pass++) {
    claim.style.fontSize = fs + 'px';
    const sum = kids.reduce((s, el) => s + el.getBoundingClientRect().width, 0);
    if (!sum) return;
    fs = Math.min(MAX_FS, Math.max(MIN_FS, fs * (target / sum)));
  }
  claim.style.fontSize = fs.toFixed(2) + 'px';
}

/** Trzyma dopasowanie przy życiu: ładowanie obrazka i fontów, resize, shrunk. */
export function watchNavClaim({ signal } = {}) {
  const img = document.querySelector('.nav-brand .nav-logo img');
  if (!img) return () => {};

  const fit = () => fitNavClaim();
  fit();

  // ResizeObserver łapie też animację wysokości logo przy nav.shrunk
  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(fit);
    ro.observe(img);
  }
  addEventListener('resize', fit, { signal, passive: true });
  addEventListener('fiq:content-ready', fit, { signal }); // CMS mogła podmienić tekst albo logo
  img.addEventListener('load', fit, { signal });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});

  return () => { if (ro) ro.disconnect(); };
}
