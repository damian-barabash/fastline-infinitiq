import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initKontakt } from '../engine/kontaktEngine.js';
import { wipeTo } from '../engine/wipe.js';
import kontaktCss from '../styles/kontakt.css?inline';

export default function Kontakt() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Kontakt — Fastline InfinitiQ';
    const destroy = initKontakt({ onNavigate: (to) => wipeTo(navigate, to) });
    return () => destroy();
  }, [navigate]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: kontaktCss }} />
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      <nav>
        <a href="/" data-wipe className="nav-back"><span className="nb-full">Wróć na stronę główną</span><span className="nb-short">Wróć</span></a>
        <a className="nav-logo" href="/" data-wipe aria-label="Fastline InfinitiQ">
          <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" />
        </a>
      </nav>

      <main>
        <div className="contact-left">
          <div className="section-label in in1">Kontakt — Zacznij tutaj</div>
          <h1 className="in in1">Briefing<br /><em>strategiczny.</em></h1>
          <p className="lead in in2">
            Pierwsze spotkanie to briefing strategiczny — <strong>bez umów, bez zobowiązań.</strong>{' '}
            Sprawdzamy, czy do siebie pasujemy.
          </p>

          <div className="steps in in3">
            <div className="step">
              <div className="step-num">01</div>
              <div>
                <h3>Briefing <span>~30 min</span></h3>
                <p>Rozmowa o Twojej marce, celach i wolumenie komunikacji. Bez prezentacji sprzedażowej.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div>
                <h3>Diagnoza &amp; roadmapa <span>do 7 dni</span></h3>
                <p>Mapujemy potencjał AI dla Twojej marki i wracamy z konkretną propozycją transformacji.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div>
                <h3>Retainer <span>od 6 miesięcy</span></h3>
                <p>Dedykowany zespół AI — strategy + execution. Systemy uczą się, strategie ewoluują.</p>
              </div>
            </div>
          </div>

          <p className="direct in in4">
            Wolisz maila? <a href="mailto:infinitiq@fastline.pl">infinitiq@fastline.pl</a>
          </p>
        </div>

        <div className="form-card in in2">
          <div className="form-title">★ Formularz briefingu</div>
          <form id="briefForm" noValidate>
            <div className="f-grid">
              <div className="f-row">
                <label htmlFor="fName">Imię i nazwisko <em>*</em></label>
                <input id="fName" name="name" type="text" placeholder="Jan Kowalski" autoComplete="name" />
              </div>
              <div className="f-row">
                <label htmlFor="fCompany">Firma</label>
                <input id="fCompany" name="company" type="text" placeholder="Nazwa firmy" autoComplete="organization" />
              </div>
            </div>
            <div className="f-row">
              <label htmlFor="fEmail">E-mail <em>*</em></label>
              <input id="fEmail" name="email" type="email" placeholder="jan@firma.pl" autoComplete="email" />
            </div>
            <div className="f-row">
              <label>Co Cię interesuje?</label>
              <div className="pills" id="pills">
                <button type="button" className="pill" data-topic="AI Strategy">AI Strategy</button>
                <button type="button" className="pill" data-topic="Generative Content">Generative Content</button>
                <button type="button" className="pill" data-topic="Brand Voice AI">Brand Voice AI</button>
                <button type="button" className="pill" data-topic="LLM Integration">LLM Integration</button>
                <button type="button" className="pill" data-topic="Marketing Automation AI">Marketing Automation</button>
                <button type="button" className="pill" data-topic="CRM & Sales AI">CRM &amp; Sales</button>
                <button type="button" className="pill" data-topic="Performance Marketing AI">Performance</button>
                <button type="button" className="pill" data-topic="AI Video & Visual">Video &amp; Visual</button>
                <button type="button" className="pill" data-topic="Nie wiem jeszcze">Nie wiem jeszcze</button>
              </div>
            </div>
            <div className="f-row">
              <label htmlFor="fMsg">Kilka słów o Twojej marce <em>*</em></label>
              <textarea id="fMsg" name="message" rows="3" placeholder="Czym się zajmujecie, jaka skala, co chcecie osiągnąć…"></textarea>
            </div>
            <div className="f-submit">
              <button type="submit" className="btn-send">Wyślij brief →</button>
              <p className="send-note">Formularz otworzy Twój program pocztowy z gotową wiadomością</p>
            </div>
            <p className="sent-ok" id="sentOk">★ Wiadomość przygotowana — sprawdź swój program pocztowy.</p>
          </form>
        </div>
      </main>

      <footer>
        <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
        <p>Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
      </footer>
    </>
  );
}
