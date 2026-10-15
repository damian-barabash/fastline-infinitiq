import React from 'react';
import BriefForm from './BriefForm.jsx';

/* Разметка страницы /kontakt — как LandingShell и AgenciShell: один и тот же DOM
   рендерят страница и редактор (вкладка „Kontakt").

   Тексты живут в CMS, строка `site_content` с id `kontakt`, префикс ключей `kt_`.
   Многострочные поля — `data-edit-type="html"` (в них Enter вставляет <br>).
   Блоки помечены `data-hideable`, секции — ещё и `data-msec` (из них меню под
   бургером строит левую колонку: на этой странице нет граней барабана).

   Пилюли «Co Cię interesuje?» рендерятся из каталога продуктов (`landing_products`,
   движок `kontaktPills.js`) — тот же список, что в меню шапки. Разметка ниже
   остаётся снимком для SSG/SEO и фолбэком, когда база недоступна. */

export default function KontaktShell() {
  return (
    <>
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      {/* Пełnoekranowe menu spod burgera — jak na pozostałych stronach */}
      <div className="menu-overlay" id="fiqMenu" hidden>
        <div className="menu-inner">
          <div className="menu-col">
            <div className="menu-cap">{'// sekcje'}</div>
            <div className="menu-list" id="menuSections"></div>
          </div>
          <div className="menu-col">
            <div className="menu-cap">{'// produkty'}</div>
            <div className="menu-list" id="menuProducts">
              <a className="menu-link" href="/ai-doradca" data-wipe><span className="menu-num">→</span><span>AI Doradca</span></a>
              <a className="menu-link" href="/agenci-ai" data-wipe><span className="menu-num">→</span><span>Agenci AI</span></a>
            </div>
            <a className="menu-cta" href="/#audyt" data-wipe>Darmowy audyt AI</a>
          </div>
        </div>
      </div>

      {/* NAV — таки же, как на главной и на странице продукта */}
      <nav>
        <div className="nav-left">
          <button className="menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false">
            <i></i><i></i><i></i>
          </button>
          <a href="/" data-wipe className="nav-back">
            <span className="nb-full" data-edit="kt_nav_back">Strona główna</span>
            <span className="nb-short" data-edit="kt_nav_back_short">Główna</span>
          </a>
        </div>
        <div className="nav-brand">
          <a className="nav-logo" href="/" data-wipe aria-label="Fastline InfinitiQ">
            <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" data-edit="kt_nav_logo" data-edit-type="image" />
          </a>
          <div className="nav-claim" id="heroClaim">
            <span className="hc-word" data-edit="kt_claim_1">Data driven.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="kt_claim_2">Mind created.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="kt_claim_3">Unique executed.</span>
          </div>
        </div>
        <a href="/#audyt" data-wipe className="nav-cta">
          <span className="cta-full" data-edit="kt_nav_cta">Darmowy audyt AI</span>
          <span className="cta-short" data-edit="kt_nav_cta_short">{'Audyt\ndla Ciebie'}</span>
        </a>
      </nav>

      {/* Jedna kolumna na środku (2026-10-15): nagłówek → formularz → mail.
          Trzy kroki „Briefing / Diagnoza / Retainer" i drugi nagłówek w karcie
          formularza zniknęły — powtarzały to, co mówi lead. */}
      <main>
        <div
          className="contact-left kt-intro"
          data-msec="Briefing"
          data-hideable="kt:intro"
          data-hide-label="Kontakt — nagłówek"
        >
          <div className="section-label in in1" data-edit="kt_label">Kontakt — Zacznij tutaj</div>
          <h1 className="in in1" data-edit="kt_h1" data-edit-type="html">Briefing <em>strategiczny.</em></h1>
          <p className="lead in in2" data-edit="kt_lead" data-edit-type="html">
            <strong>Bez umów, bez zobowiązań.</strong> Zostaw dane i adres strony: przeczytamy ją,
            powiemy, co u Was przejmie AI, a potem sam wybierzesz termin rozmowy.
          </p>
        </div>

        <div
          className="form-card in in2"
          data-msec="Formularz"
          data-hideable="kt:form"
          data-hide-label="Kontakt — formularz briefingu"
        >
          <BriefForm />
        </div>

        <p className="direct in in3" data-hideable="kt:direct" data-hide-label="Kontakt — mail bezpośredni">
          <span data-edit="kt_direct_l">Wolisz maila?</span>{' '}
          <a href="mailto:infinitiq@fastline.pl" data-edit="kt_direct_mail">infinitiq@fastline.pl</a>
        </p>
      </main>

      <footer data-hideable="kt:footer" data-hide-label="Kontakt — stopka">
        <p data-edit="kt_foot_1" data-edit-type="html">© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
        <p data-edit="kt_foot_2" data-edit-type="html">Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
        <p className="footer-legal"><a href="/polityka-prywatnosci" data-wipe>Polityka prywatności</a><a href="/polityka-cookies" data-wipe>Cookies</a><a href="/regulamin" data-wipe>Regulamin</a><a href="/usuwanie-danych" data-wipe>Usuwanie danych</a></p>
      </footer>
    </>
  );
}
