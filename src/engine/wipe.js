// SPA-версия шторки перехода: exit (w-out, накрывает вверх) → navigate →
// WipeController в App делает entrance (w-in, уходит вверх). Классы w-in/w-out —
// НЕ .in/.out (грабля kontakt: .in занят entrance-анимацией контента).
export function mapLegacyHref(href) {
  if (!href) return '/';
  if (href.endsWith('kontakt.html')) return '/kontakt';
  if (href.endsWith('index.html')) return '/';
  if (href.endsWith('login.html')) return '/login';
  if (href.endsWith('editor.html')) return '/editor';
  return href;
}

export function wipeTo(navigate, to) {
  const w = document.getElementById('wipe');
  if (!w) { navigate(to); return; }
  w.classList.remove('w-in', 'noanim');
  w.classList.add('w-out', 'cover');
  setTimeout(() => navigate(to), 680);
}

// делегированный перехват внутренних ссылок (работает и для блоков CMS,
// вставленных после инициализации движка)
export function interceptInternalLinks(onNavigate, signal) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-wipe], a[href$=".html"]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    onNavigate(mapLegacyHref(a.getAttribute('href')));
  }, { signal });
}
