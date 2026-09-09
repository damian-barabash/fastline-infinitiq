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

/* ===== Scramble-декод клейма =====
   Текст живёт в разметке (SEO/SSG) — движок только «проявляет» его глиф-шумом.
   На лендинге старт ждёт CMS и ухода прелоадера (иначе декод отыграл бы под
   оверлеем или по тексту, который CMS ещё заменит); на страницах продуктов
   ждать нечего — `immediate: true`. */
const HC_GLYPHS = '#/\\<>[]{}=+*^-01';

export function initClaimScramble({ signal, immediate = false } = {}) {
  const words = Array.from(document.querySelectorAll('#heroClaim .hc-word'));
  if (!words.length) return null;

  const COARSE = matchMedia('(hover: none), (pointer: coarse)').matches;
  const timers = [];
  let dead = false;
  const ct = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };

  function scrambleWord(el, flash) {
    if (!el || el._hcRun || dead) return;
    const target = el.textContent;
    if (!target) return;
    el._hcRun = true;
    if (flash) el.classList.add('hc-on');
    const len = target.length;
    const DUR = 620;
    const t0 = performance.now();
    let lastDraw = 0;
    function step(now) {
      if (dead) { el._hcRun = false; return; }
      const p = Math.min(1, (now - t0) / DUR);
      // глифы меняем ~каждые 34мс, не каждый кадр — иначе на 120Гц сплошное мельтешение
      if (now - lastDraw >= 34 || p >= 1) {
        lastDraw = now;
        const reveal = Math.floor(p * len);
        let out = target.slice(0, reveal);
        for (let i = reveal; i < len; i++) {
          const c = target[i];
          out += c === ' ' ? ' ' : HC_GLYPHS[(Math.random() * HC_GLYPHS.length) | 0];
        }
        el.textContent = out;
      }
      if (p < 1) { requestAnimationFrame(step); return; }
      el.textContent = target;
      el._hcRun = false;
      if (flash) ct(() => el.classList.remove('hc-on'), 450);
    }
    requestAnimationFrame(step);
  }

  let started = false;
  function start() {
    if (started || dead) return;
    started = true;
    words.forEach((w, i) => ct(() => scrambleWord(w, true), 180 + i * 320));
    // редкий глитч-пульс одного слова; клейм живёт в шапке — виден на всех гранях
    timers.push(setInterval(() => {
      if (document.hidden) return;
      scrambleWord(words[(Math.random() * words.length) | 0], false);
    }, 7000));
  }

  if (immediate) {
    ct(start, 320);
  } else {
    let contentReady = false;
    addEventListener('fiq:content-ready', () => { contentReady = true; }, { signal });
    ct(() => { contentReady = true; }, 4600);           // страховка, если событие не пришло
    const armId = setInterval(() => {
      if (dead || started) { clearInterval(armId); return; }
      if (contentReady && !document.getElementById('fiqLoader')) {
        clearInterval(armId);
        ct(start, 260);
      }
    }, 120);
    timers.push(armId);
  }

  // интерактив: ховер (точный указатель) / тап (coarse) пере-декодирует фразу
  words.forEach((w) => {
    const re = () => scrambleWord(w, true);
    if (COARSE) w.addEventListener('click', re, { signal });
    else w.addEventListener('mouseenter', re, { signal });
  });

  return {
    destroy() {
      dead = true;
      timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
      timers.length = 0;
    },
  };
}
