import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KontaktShell from '../components/KontaktShell.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initKontakt } from '../engine/kontaktEngine.js';
import { wipeTo } from '../engine/wipe.js';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import kontaktCss from '../styles/kontakt.css?inline';

/* Strona /kontakt. Treść edytuje się w /editor (zakładka „Kontakt") — CMS trzyma
   ją w wierszu `site_content` o id `kontakt`, a markup zostaje snapshotem dla SSG.
   Sam formularz to `BriefForm.jsx` — dwa kroki, analiza strony i kalendarz
   (edge `brief-lead`); lista produktów w nim pochodzi z katalogu, jak w menu. */

export default function Kontakt() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Kontakt — Fastline InfinitiQ';
    ensureFIQ();
    const destroy = initKontakt({ onNavigate: (to) => wipeTo(navigate, to) });

    // CMS + katalog: czysty REST, bez supabase-js (ta sama zasada co na lądowaniu)
    let alive = true;
    const ac = new AbortController();
    const get = (q) => fetch(`${SB_URL}/rest/v1/${q}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ac.signal,
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    get('site_content?id=eq.kontakt&select=published')
      .then((rows) => {
        if (!alive) return;
        const published = rows && rows[0] && rows[0].published;
        if (published && window.FIQ) window.FIQ.applyContent(published, { editor: false });
      })
      .catch(() => {})
      .finally(() => {
        if (alive) window.dispatchEvent(new Event('fiq:content-ready'));
      });

    return () => { alive = false; ac.abort(); destroy(); };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: kontaktCss }} />
      <KontaktShell />
    </>
  );
}
