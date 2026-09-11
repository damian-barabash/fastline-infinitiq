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
      {/* usunięcie bloku jest nieodwracalne — trzeba przepisać losowy kod */}
      <div id="fiqConfirm">
        <div className="fiq-confirm-card">
          <div className="fiq-pal-head">Usunąć blok?</div>
          <div className="fiq-pal-sub" id="fiqConfirmWhat"></div>
          <p className="fiq-confirm-lead">
            Tego nie da się cofnąć przyciskiem „ukryj". Przepisz kod, żeby potwierdzić:
          </p>
          <div className="fiq-confirm-code" id="fiqConfirmCode"></div>
          <input className="fiq-confirm-input" id="fiqConfirmInput" inputMode="numeric" autoComplete="off" placeholder="0000000000" />
          <div className="fiq-confirm-row">
            <button className="fiq-btn" id="fiqConfirmCancel">Anuluj</button>
            <button className="fiq-btn danger" id="fiqConfirmOk" disabled>Usuń blok</button>
          </div>
        </div>
      </div>
      {/* pływający pasek formatowania zaznaczonego tekstu (logika: editorLayer.js) */}
      <div id="fiqFmt" role="toolbar" aria-label="Formatowanie zaznaczenia">
        <div className="fiq-fmt-row">
          <button type="button" className="fiq-fmt-btn fb-b" data-fmt="bold" title="Pogrubienie (Ctrl+B)">B</button>
          <button type="button" className="fiq-fmt-btn fb-i" data-fmt="italic" title="Kursywa (Ctrl+I)">I</button>
          <button type="button" className="fiq-fmt-btn fb-u" data-fmt="underline" title="Podkreślenie (Ctrl+U)">U</button>
          <button type="button" className="fiq-fmt-btn fb-s" data-fmt="strike" title="Przekreślenie">S</button>
          <span className="fiq-fmt-sep" />
          <button type="button" className="fiq-fmt-btn fb-acid" data-fmt="acid" title="Kolor kwasowy">●</button>
          <button type="button" className="fiq-fmt-btn fb-mark" data-fmt="mark" title="Podświetlenie">▮</button>
          <button type="button" className="fiq-fmt-btn" data-fmt="upper" title="Wielkie litery">AA</button>
          <button type="button" className="fiq-fmt-btn" data-fmt="small" title="Mniejszy tekst">A−</button>
          <button type="button" className="fiq-fmt-btn" data-fmt="big" title="Większy tekst">A+</button>
          <span className="fiq-fmt-sep" />
          <button type="button" className="fiq-fmt-btn fb-w" data-panel="color" title="Dowolny kolor">Kolor</button>
          <button type="button" className="fiq-fmt-btn fb-w" data-panel="size" title="Dowolny rozmiar">Rozmiar</button>
          <button type="button" className="fiq-fmt-btn fb-w" data-panel="link" title="Link">Link</button>
          <button type="button" className="fiq-fmt-btn fb-w" data-panel="css" title="Własny CSS dla zaznaczenia">CSS</button>
          <span className="fiq-fmt-sep" />
          <button type="button" className="fiq-fmt-btn del" data-fmt="clear" title="Wyczyść formatowanie">✕</button>
        </div>
        <div className="fiq-fmt-panel" id="fiqFmtPanel" hidden>
          <div className="fiq-fmt-lab" id="fiqFmtLab"></div>
          <div className="fiq-fmt-presets" id="fiqFmtPresets"></div>
          <div className="fiq-fmt-inrow">
            <input className="fiq-fmt-input" id="fiqFmtInput" autoComplete="off" spellCheck="false" />
            <button type="button" className="fiq-btn primary" id="fiqFmtApply">Zastosuj</button>
          </div>
          <div className="fiq-fmt-hint" id="fiqFmtHint"></div>
        </div>
      </div>
      <div id="fiqBar" style={{ display: 'none' }}>
        <span className="fiq-brand">InfinitiQ · Edytor</span>
        <span className="fiq-tabs">
          {/* stron będzie przybywać — wybór z listy, nie rząd przycisków */}
          <select
            className="fiq-page-select"
            value={tab === 'audyty' ? page : tab}
            onChange={(e) => setTab(e.target.value)}
            aria-label="Strona do edycji"
          >
            {Object.keys(PAGES).map((key) => (
              <option key={key} value={key}>{PAGES[key].label}</option>
            ))}
          </select>
          <button className={'fiq-tab-btn' + (tab === 'audyty' ? ' on' : '')} onClick={() => setTab(tab === 'audyty' ? page : 'audyty')}>Audyt</button>
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
