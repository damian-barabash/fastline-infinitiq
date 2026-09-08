import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingShell from '../components/LandingShell.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initLanding } from '../engine/landingEngine.js';
import { initHeroSphere } from '../engine/heroSphere.js';
import { renderHeroProducts, LANDING_PRODUCTS_QUERY } from '../engine/heroProducts.js';
import { wipeTo } from '../engine/wipe.js';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import landingCss from '../styles/landing.css?inline';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Fastline InfinitiQ — AI-Native Agency';
    ensureFIQ();
    let destroy = initLanding({ onNavigate: (to) => wipeTo(navigate, to) });
    let destroyPlanet = initHeroSphere();
    if (window.__fiq) window.__fiq.set(72); // движок поднят

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (window.__fiq) window.__fiq.set(85); });
    }

    // подгрузка опубликованного контента из Supabase (CMS) и katalogu produktów.
    // Прямой REST-fetch вместо supabase-js: лендинг не тянет клиентскую библиотеку.
    // Оба запроса параллельно — прелоадер уходит, когда применены оба.
    let alive = true;
    const ac = new AbortController();
    const get = (q) => fetch(`${SB_URL}/rest/v1/${q}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ac.signal,
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    Promise.all([get('site_content?id=eq.index&select=published'), get(LANDING_PRODUCTS_QUERY)])
      .then(([rows, products]) => {
        if (!alive) return;
        // Karty hero z katalogu — jedno źródło z audytem. Gdy baza milczy,
        // zostaje snapshot z markupu (ten sam, który widzą boty w SSG).
        const rebuilt = renderHeroProducts(products);

        let sphereReinited = false;

        const published = rows && rows[0] && rows[0].published;
        if (published && window.FIQ) {
          window.FIQ.applyContent(published, { editor: false });

          // Секции, скрытые через CMS (_hidden: "sec:<id>"): applyContent дал им
          // display:none, но барабан уже измерил все грани — физически убираем
          // грань + её пункт рейла и пере-инициализируем движок. Всё происходит
          // за прелоадером, юзер перестройки не видит.
          const hiddenSlides = Array.from(document.querySelectorAll('.slide[data-hideable]'))
            .filter((s) => s.style.display === 'none');
          if (hiddenSlides.length) {
            destroy();
            const all = Array.from(document.querySelectorAll('.slide'));
            const rail = Array.from(document.querySelectorAll('.rail-item'));
            hiddenSlides.forEach((s) => {
              const i = all.indexOf(s);
              if (rail[i]) rail[i].remove();
              s.remove();
            });
            document.querySelectorAll('.rail-item').forEach((b, i) => { b.dataset.i = String(i); });
            const total = document.querySelectorAll('.slide').length;
            const cntTotal = document.querySelector('#counter span:last-child');
            if (cntTotal) cntTotal.textContent = '/ ' + String(total).padStart(2, '0');
            destroy = initLanding({ onNavigate: (to) => wipeTo(navigate, to) });
            destroyPlanet(); destroyPlanet = initHeroSphere();
            sphereReinited = true;
          }

          // строки услуг могли перестроиться — пере-инициализируем демо
          if (typeof window.fiqInitServices === 'function') window.fiqInitServices();
          // высоты слайдов изменились (блоки/списки) — пересчёт барабана
          if (typeof window.fiqRemeasure === 'function') requestAnimationFrame(() => window.fiqRemeasure());
        }

        // Silnik kuli trzyma listę kart z chwili startu — po przebudowie z katalogu
        // musi ją przeczytać jeszcze raz (chyba że i tak wstał przy ukrytych graniach).
        if (rebuilt && !sphereReinited) { destroyPlanet(); destroyPlanet = initHeroSphere(); }
      })
      .catch(() => {})
      .finally(() => {
        // контент применён (или БД пуста/недоступна — дефолты уже в HTML) → прелоадер уходит
        if (!alive) return;
        window.dispatchEvent(new Event('fiq:content-ready')); // старт декода hero-клейма
        if (window.__fiq) window.__fiq.done();
      });

    return () => { alive = false; ac.abort(); destroyPlanet(); destroy(); };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landingCss }} />
      <LandingShell />
    </>
  );
}
