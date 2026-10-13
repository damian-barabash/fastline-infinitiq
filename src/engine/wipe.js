// SPA-версия шторки перехода: exit (w-out, накрывает вверх) → navigate →
// WipeController в App делает entrance (w-in, уходит вверх). Классы w-in/w-out —
// НЕ .in/.out (грабля kontakt: .in занят entrance-анимацией контента).
import { preloadPath } from '../lib/pages.jsx';

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
  // paczka JS strony docelowej dociąga się, gdy kurtyna się zamyka; nawigujemy,
  // gdy minie animacja ORAZ paczka jest gotowa (limit 4 s — potem i tak idziemy)
  const loaded = Promise.race([preloadPath(to), new Promise((r) => setTimeout(r, 4000))]);
  const closed = new Promise((r) => setTimeout(r, 680));
  Promise.all([loaded, closed]).then(() => navigate(to));
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
