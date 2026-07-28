import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingShell from '../components/LandingShell.jsx';
import AudytPanel from '../components/AudytPanel.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initEditorLayer } from '../engine/editorLayer.js';
import { sbAuth } from '../lib/supabase.js';
import editorCss from '../styles/editor.css?inline';
import audytCss from '../styles/audyt-panel.css?inline';

export default function Editor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('strona');

  useEffect(() => {
    document.title = 'Edytor — Fastline InfinitiQ';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    // плоский режим (без 3D-движка, скролл обычный) — как в старом editor.html
    document.documentElement.classList.add('mode-flat');
    ensureFIQ();
    const destroy = initEditorLayer({
      sb: sbAuth(),
      onRequireLogin: (needAuth) => navigate(needAuth ? '/login?auth=required' : '/login', { replace: true }),
    });

    return () => {
      destroy();
      document.documentElement.classList.remove('mode-flat');
      meta.remove();
    };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: editorCss }} />
      <style dangerouslySetInnerHTML={{ __html: audytCss }} />

      {/* ===== РЕДАКТОР: оверлеи и панель ===== */}
      <div id="fiqGate">Ładowanie edytora…</div>
      <input type="file" id="fiqFile" accept="image/*" style={{ display: 'none' }} />
      <div id="fiqToast"></div>
      <div id="fiqPal">
        <div className="fiq-pal-card">
          <div className="fiq-pal-head">Dodaj blok</div>
          <div className="fiq-pal-sub">{'// wybierz szablon — pojawi się na końcu sekcji'}</div>
          <div className="fiq-pal-grid" id="fiqPalGrid"></div>
          <button className="fiq-pal-close" id="fiqPalClose">Anuluj</button>
        </div>
      </div>
      <div id="fiqBar" style={{ display: 'none' }}>
        <span className="fiq-brand">InfinitiQ · Edytor</span>
        <span className="fiq-tabs">
          <button className={'fiq-tab-btn' + (tab === 'strona' ? ' on' : '')} onClick={() => setTab('strona')}>Strona</button>
          <button className={'fiq-tab-btn' + (tab === 'audyty' ? ' on' : '')} onClick={() => setTab('audyty')}>Audyt</button>
        </span>
        <span id="fiqStatus" className="saved"><span className="dot"></span><span id="fiqStatusText">Zapisano</span></span>
        <span className="fiq-spacer"></span>
        <span className="fiq-user" id="fiqUser"></span>
        <button className="fiq-btn" id="fiqSaveDraft">Zapisz jako wersję roboczą</button>
        <button className="fiq-btn primary" id="fiqSave">Zapisz</button>
        <button className="fiq-btn logout" id="fiqLogout" title="Wyloguj się">Wyloguj</button>
      </div>

      {tab === 'audyty' && <AudytPanel />}

      <LandingShell />
    </>
  );
}
