import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { preloadPath, preloadRest } from './lib/pages.jsx';

const root = document.getElementById('root');
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// пререндеренные страницы гидрируем, остальные монтируем с нуля.
// Paczka strony z adresu musi być gotowa przed hydracją (render synchroniczny);
// pozostałe strony dociągają się w wolnej chwili — przejścia w SPA są wtedy natychmiastowe.
preloadPath(location.pathname).then(() => {
  if (root.firstElementChild) hydrateRoot(root, app);
  else createRoot(root).render(app);
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  const rest = () => idle(() => preloadRest());
  if (document.readyState === 'complete') setTimeout(rest, 3000);
  else addEventListener('load', () => setTimeout(rest, 3000), { once: true });
});
