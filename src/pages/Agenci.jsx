import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AgenciShell from '../components/AgenciShell.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initAgenci } from '../engine/agenciEngine.js';
import { wipeTo } from '../engine/wipe.js';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import agenciCss from '../styles/agenci.css?inline';

/* LP zbiorcza czterech agentów (AI Sprzedawca · AI Doradca · AI Recepcjonistka ·
   AI Asystent). Teksty przeniesione 1:1 z makiety właściciela
   (FQ_Agenci_LP_zbiorcza.pptx); dołożone są tylko wizualizacje pracy agentów.
   Treść edytuje się w /editor (zakładka „Agenci AI") — CMS trzyma ją w wierszu
   `site_content` o id `agenci-ai`, a markup zostaje snapshotem dla SSG. */

export default function Agenci() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Agenci AI — zespół, który pracuje, kiedy Ty śpisz | Fastline InfinitiQ';
    ensureFIQ();
    const destroy = initAgenci({ onNavigate: (to) => wipeTo(navigate, to) });

    // treść z CMS: czysty REST, bez supabase-js (ta sama zasada co na lądowaniu)
    let alive = true;
    const ac = new AbortController();
    fetch(`${SB_URL}/rest/v1/site_content?id=eq.agenci-ai&select=published`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
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
      <style dangerouslySetInnerHTML={{ __html: agenciCss }} />
      <AgenciShell />
    </>
  );
}
