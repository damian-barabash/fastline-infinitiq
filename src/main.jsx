import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

const root = document.getElementById('root');
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

// пререндеренные страницы (/ и /kontakt) гидрируем, остальные монтируем с нуля
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
