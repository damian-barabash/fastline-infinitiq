import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingShell from '../components/LandingShell.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initLanding } from '../engine/landingEngine.js';
import { wipeTo } from '../engine/wipe.js';
import { sbPublic } from '../lib/supabase.js';
import landingCss from '../styles/landing.css?inline';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Fastline InfinitiQ — AI-Native Agency';
    ensureFIQ();
    const destroy = initLanding({ onNavigate: (to) => wipeTo(navigate, to) });

    // подгрузка опубликованного контента из Supabase (CMS)
    let alive = true;
    sbPublic().from('site_content').select('published').eq('id', 'index').maybeSingle()
      .then(({ data }) => {
        if (!alive || !data || !data.published || !window.FIQ) return;
        window.FIQ.applyContent(data.published, { editor: false });
        // строки услуг могли перестроиться — пере-инициализируем демо
        if (typeof window.fiqInitServices === 'function') window.fiqInitServices();
        // высоты слайдов изменились (блоки/списки) — пересчёт барабана
        if (typeof window.fiqRemeasure === 'function') requestAnimationFrame(() => window.fiqRemeasure());
      })
      .catch(() => {});

    return () => { alive = false; destroy(); };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landingCss }} />
      <LandingShell />
    </>
  );
}
