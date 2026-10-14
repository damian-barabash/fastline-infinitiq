import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DoradcaShell from '../components/DoradcaShell.jsx';
import { ensureFIQ } from '../engine/fiq.js';
import { initAgenci } from '../engine/agenciEngine.js';
import { initDoradcaFx } from '../engine/doradcaFx.js';
import { wipeTo } from '../engine/wipe.js';
import { SB_URL, SB_KEY } from '../lib/supabase-config.js';
import agenciCss from '../styles/agenci.css?inline';
import doradcaCss from '../styles/doradca.css?inline';
import siteCss from '../styles/site.css?inline';

/* LP produktu AI Doradca (/ai-doradca). Rama i silnik wspólne z /agenci-ai
   (`initAgenci`: menu, kursor, sceny rozmów); sekcje to zwykły przewijany
   dokument (bębna 3D nie ma na żadnej stronie). Treść edytuje się w /editor
   (zakładka „AI Doradca") — wiersz `site_content` o id `ai-doradca`.

   DEMO_KEY = publiczny klucz kanału widget w Brain (projekt z ofertą FIQ).
   Ustawiony → w oknie demo ląduje żywy czat (ta sama ramka `/w`, którą ładuje
   widget na stronach klientów). Pusty → zostaje odgrywana scena z markupu. */
const DEMO_KEY = '';
const DEMO_ORIGIN = 'https://brain.fastlineinfinitiq.pl';

function mountLiveDemo() {
  const box = document.querySelector('#adDemo [data-live]');
  if (!DEMO_KEY || !box || box.querySelector('iframe')) return;
  const f = document.createElement('iframe');
  f.title = 'Rozmowa z AI Doradcą';
  f.loading = 'lazy';
  f.src = `${DEMO_ORIGIN}/w?key=${encodeURIComponent(DEMO_KEY)}&color=${encodeURIComponent('#B8FF00')}&bg=${encodeURIComponent('#0D0D0D')}`;
  box.appendChild(f);
  box.classList.add('live');
}

export default function Doradca() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'AI Doradca — doradza klientom na Twojej stronie 24/7 | Fastline InfinitiQ';
    ensureFIQ();
    let destroy = initAgenci({ onNavigate: (to) => wipeTo(navigate, to) });
    mountLiveDemo();
    // po `initAgenci`: klasy trybu (mode-flat / mode-desk) są już ustawione na <html>
    const fxAc = new AbortController();
    const stopFx = initDoradcaFx({ signal: fxAc.signal });

    let alive = true;
    const ac = new AbortController();
    fetch(`${SB_URL}/rest/v1/site_content?id=eq.ai-doradca&select=published`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!alive) return;
        const published = rows && rows[0] && rows[0].published;
        if (published && window.FIQ) {
          const slideIds = () => Array.from(document.querySelectorAll('.slide')).map((s) => s.id).join();
          const before = slideIds();
          window.FIQ.applyContent(published, { editor: false });

          // ukryta albo przestawiona sekcja: silnik trzyma listę sekcji z chwili startu,
          // więc usuwamy ją fizycznie i stawiamy silnik od nowa (jak na /agenci-ai)
          const hiddenSlides = Array.from(document.querySelectorAll('.slide[data-hideable]'))
            .filter((el) => el.style.display === 'none');
          if (hiddenSlides.length || slideIds() !== before) {
            destroy();
            const all = Array.from(document.querySelectorAll('.slide'));
            const rail = Array.from(document.querySelectorAll('.rail-item'));
            hiddenSlides.forEach((el) => {
              const i = all.indexOf(el);
              if (rail[i]) rail[i].remove();
              el.remove();
            });
            document.querySelectorAll('.rail-item').forEach((b, i) => { b.dataset.i = String(i); });
            const total = document.querySelectorAll('.slide').length;
            const cntTotal = document.querySelector('#counter span:last-child');
            if (cntTotal) cntTotal.textContent = '/ ' + String(total).padStart(2, '0');
            destroy = initAgenci({ onNavigate: (to) => wipeTo(navigate, to) });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) window.dispatchEvent(new Event('fiq:content-ready'));
      });

    return () => { alive = false; ac.abort(); fxAc.abort(); stopFx(); destroy(); };
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: agenciCss }} />
      <style dangerouslySetInnerHTML={{ __html: doradcaCss }} />
      <style dangerouslySetInnerHTML={{ __html: siteCss }} />
      <DoradcaShell />
    </>
  );
}
