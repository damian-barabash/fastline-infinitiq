import React, { lazy, useState } from 'react';

/* Strony publiczne jako osobne paczki JS (2026-10-13): odwiedzający pobiera kod
   tylko tej strony, na którą wszedł, a nie wszystkich naraz.

   SSG + hydracja wymagają, żeby strona z adresu wyrenderowała się SYNCHRONICZNIE
   (lazy/Suspense w `renderToString` i przy hydracji = rozjazd z gotowym HTML):
   - serwer (`entry-server.jsx`) rejestruje wszystkie strony przez `registerPage`,
   - klient (`main.jsx`) przed hydracją czeka na `preloadPath(location.pathname)`,
   - przejścia w SPA: `wipeTo` dociąga paczkę celu, zanim kurtyna się zamknie;
     po starcie reszta stron dociąga się w wolnej chwili (`preloadRest`). */

const loaders = {
  Home: () => import('../pages/Home.jsx'),
  Kontakt: () => import('../pages/Kontakt.jsx'),
  Agenci: () => import('../pages/Agenci.jsx'),
  Doradca: () => import('../pages/Doradca.jsx'),
  Legal: () => import('../pages/Legal.jsx'),
};

const LEGAL = ['/polityka-prywatnosci', '/polityka-cookies', '/regulamin', '/usuwanie-danych'];
const ready = {};

export function registerPage(key, Component) { ready[key] = Component; }

export function keyForPath(pathname) {
  const p = (pathname || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/index.html') return 'Home';
  if (p === '/kontakt') return 'Kontakt';
  if (p === '/agenci-ai') return 'Agenci';
  if (p === '/ai-doradca') return 'Doradca';
  if (LEGAL.includes(p)) return 'Legal';
  return null;
}

export function preloadPage(key) {
  if (!key || !loaders[key] || ready[key]) return Promise.resolve();
  return loaders[key]().then((m) => { ready[key] = m.default; }).catch(() => {});
}
export const preloadPath = (pathname) => preloadPage(keyForPath(pathname));
export const preloadRest = () => Promise.all(Object.keys(loaders).map(preloadPage));

export function page(key) {
  const Lazy = lazy(loaders[key]);
  // typ komponentu wybierany raz na montaż — podmiana w locie przemontowałaby stronę
  return function Page(props) {
    const [C] = useState(() => ready[key] || Lazy);
    return <C {...props} />;
  };
}
