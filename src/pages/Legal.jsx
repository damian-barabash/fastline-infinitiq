import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LegalShell from '../components/LegalShell.jsx';
import { LEGAL } from '../content/legal.js';
import { initKontakt } from '../engine/kontaktEngine.js';
import { wipeTo } from '../engine/wipe.js';
import kontaktCss from '../styles/kontakt.css?inline';
import legalCss from '../styles/legal.css?inline';

/* Strony /polityka-prywatnosci, /polityka-cookies, /regulamin, /usuwanie-danych.
   Rama i silnik jak na /kontakt (kursor, menu pod burgerem, claim, siatka),
   treść statyczna z `src/content/legal.js` — pełna w SSG. */

export default function Legal({ slug }) {
  const navigate = useNavigate();
  const doc = LEGAL[slug];

  useEffect(() => {
    document.title = `${doc.title} — Fastline InfinitiQ`;
    const destroy = initKontakt({ onNavigate: (to) => wipeTo(navigate, to) });
    // nie ma CMS — menu i claim czekają na ten sygnał tak samo jak na /kontakt
    window.dispatchEvent(new Event('fiq:content-ready'));
    return () => destroy();
  }, [navigate, doc.title]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: kontaktCss + legalCss }} />
      <LegalShell doc={doc} slug={slug} />
    </>
  );
}
