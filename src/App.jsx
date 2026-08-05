import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Kontakt from './pages/Kontakt.jsx';

// Не-пререндеренные роуты — lazy: supabase-js + редакторский код не попадают
// в основной бандл лендинга. В SSG рендерятся только / и /kontakt (eager).
const Login = lazy(() => import('./pages/Login.jsx'));
const Editor = lazy(() => import('./pages/Editor.jsx'));
const Audit = lazy(() => import('./pages/Audit.jsx'));

// #wipe живёт в App (переживает смену роутов). CSS шторки есть в стилях каждой
// страницы (байт-в-байт из исходников), плюс минимальный fallback в index.html.
function WipeController() {
  const location = useLocation();

  useEffect(() => {
    const w = document.getElementById('wipe');
    if (!w) return;
    // на входе в роут: шторка закрыта (w-in), затем непрерывный уход вверх
    w.classList.add('noanim', 'cover', 'w-in');
    w.classList.remove('w-out');
    window.scrollTo(0, 0);
    void w.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      w.classList.remove('noanim');
      w.classList.remove('cover');
    }));
  }, [location.pathname]);

  useEffect(() => {
    const onShow = (e) => {
      if (!e.persisted) return;
      const w = document.getElementById('wipe');
      if (!w) return;
      w.classList.add('noanim');
      w.classList.remove('cover', 'w-out');
      w.classList.add('w-in');
    };
    addEventListener('pageshow', onShow);
    return () => removeEventListener('pageshow', onShow);
  }, []);

  return <div id="wipe" className="cover w-in noanim"></div>;
}

export default function App() {
  return (
    <>
      <WipeController />
      <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kontakt" element={<Kontakt />} />
        <Route path="/login" element={<Login />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/audyt/:slug" element={<Audit />} />
        {/* legacy-адреса старой статики */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/kontakt.html" element={<Navigate to="/kontakt" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/editor.html" element={<Navigate to="/editor" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
