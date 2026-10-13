import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App.jsx';
import { registerPage } from './lib/pages.jsx';
import Home from './pages/Home.jsx';
import Kontakt from './pages/Kontakt.jsx';
import Agenci from './pages/Agenci.jsx';
import Doradca from './pages/Doradca.jsx';
import Legal from './pages/Legal.jsx';

// SSG renderuje synchronicznie — wszystkie strony publiczne są gotowe od razu
registerPage('Home', Home);
registerPage('Kontakt', Kontakt);
registerPage('Agenci', Agenci);
registerPage('Doradca', Doradca);
registerPage('Legal', Legal);

export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  );
}
