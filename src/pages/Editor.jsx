import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingShell from '../components/LandingShell.jsx';
import AgenciShell from '../components/AgenciShell.jsx';
import AudytPanel from '../components/AudytPanel.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initEditorLayer } from '../engine/editorLayer.js';
import { sbAuth } from '../lib/supabase.js';
import editorCss from '../styles/editor.css?inline';
import editorUiCss from '../styles/editor-ui.css?inline';
import agenciCss from '../styles/agenci.css?inline';
import audytCss from '../styles/audyt-panel.css?inline';

/* Редактор обслуживает несколько страниц. Каждая = свой Shell + своя строка
   `site_content` (лендинг — `index`, страница продукта — `agenci-ai`).
   Переключение вкладки полностью пере-инициализирует редакторский слой:
   contenteditable вешается на конкретный DOM, поэтому старый слой надо снять. */
const PAGES = {
  strona: { label: 'Strona główna', id: 'index', css: editorCss },
  agenci: { label: 'Agenci AI', id: 'agenci-ai', css: agenciCss },
};

export default function Editor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('strona');          // strona | agenci | audyty
  const page = PAGES[tab] ? tab : 'strona';          // вкладка «Audyt» не меняет страницу

  useEffect(() => {
    document.title = 'Edytor — Fastline InfinitiQ';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    // плоский режим (без 3D-движка, скролл обычный) — как в старом editor.html
    document.documentElement.classList.add('mode-flat');
    ensureFIQ();
    const destroy = initEditorLayer({
      sb: sbAuth(),
      onRequireLogin: (needAuth) => navigate(needAuth ? '/login?auth=required' : '/login', { replace: true }),
      pageId: PAGES[page].id,
    });

    return () => {
      destroy();
      document.documentElement.classList.remove('mode-flat');
    };
  }, [navigate, page]);

  return (
    <>
      {/* стиль редактируемой страницы + общий UI редактора */}
      <style dangerouslySetInnerHTML={{ __html: PAGES[page].css }} />
      <style dangerouslySetInnerHTML={{ __html: editorUiCss }} />
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
          <button className={'fiq-tab-btn' + (tab === 'strona' ? ' on' : '')} onClick={() => setTab('strona')}>Strona główna</button>
          <button className={'fiq-tab-btn' + (tab === 'agenci' ? ' on' : '')} onClick={() => setTab('agenci')}>Agenci AI</button>
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

      {page === 'strona' ? <LandingShell /> : <AgenciShell />}
    </>
  );
}
