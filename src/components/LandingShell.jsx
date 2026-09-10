import React from 'react';
import AuditForm from './AuditForm.jsx';
import ProductIcon from './productIcons.jsx';

// Разметка главной 1:1 из index.html (те же классы/ids/data-атрибуты).
// Используется главной (с 3D-движком) и редактором (mode-flat).
// Внутренние ссылки: href на роуты + data-wipe (перехват в движке).
export default function LandingShell() {
  return (
    <>
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      {/* Pełnoekranowe menu spod burgera (burger siedzi w nav) */}
      <div className="menu-overlay" id="fiqMenu" hidden>
        <div className="menu-inner">
          <div className="menu-col">
            <div className="menu-cap">{'// sekcje'}</div>
            <div className="menu-list" id="menuSections"></div>
          </div>
          <div className="menu-col">
            <div className="menu-cap">{'// produkty'}</div>
            {/* lista z katalogu (`landing_products`): produkt ze swoją stroną jest
                linkiem, pozostałe stoją na szaro — widać całą ofertę i to, co gotowe */}
            <div className="menu-list" id="menuProducts">
              <a className="menu-link" href="/agenci-ai" data-wipe><span className="menu-num">→</span><span>Agenci AI</span></a>
            </div>
            <a className="menu-cta" href="/#audyt" data-wipe>Darmowy audyt AI</a>
          </div>
        </div>
      </div>

      {/* NAV */}
      <nav>
        <div className="nav-left">
        <button className="menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false">
          <i></i><i></i><i></i>
        </button>
        </div>
        {/* logo + claim = jeden lokal marki: claim ma dokładnie szerokość logo
            (kegl dobiera silnik w navClaim.js), litery „wywołują się" glifami */}
        <div className="nav-brand">
          <a className="nav-logo" href="#" id="navHome" aria-label="Fastline InfinitiQ">
            <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" data-edit="nav_logo" data-edit-type="image" />
          </a>
          <div className="nav-claim" id="heroClaim">
            <span className="hc-word" data-edit="hero_claim_1">Data driven.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="hero_claim_2">Mind created.</span>
            <span className="hc-sep" aria-hidden="true"></span>
            <span className="hc-word" data-edit="hero_claim_3">Unique executed.</span>
          </div>
        </div>
        <a href="#audyt" data-goto="1" className="nav-cta"><span className="cta-full" data-edit="nav_cta_full">Darmowy audyt AI</span><span className="cta-short" data-edit="nav_cta_short">Audyt</span></a>
      </nav>

      {/* PROGRESS RAIL */}
      <div className="rail" id="rail" role="navigation" aria-label="Sekcje">
        <button className="rail-item" data-i="0"><span className="rail-name">Start</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="1"><span className="rail-name">Darmowy audyt</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="2"><span className="rail-name">Czym jesteśmy</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="3"><span className="rail-name">Oferta</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="4"><span className="rail-name">Model</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="5"><span className="rail-name">Co robimy</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="6"><span className="rail-name">Grupa</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="7"><span className="rail-name">Kontakt</span><span className="rail-tick"></span></button>
      </div>

      <div className="counter" id="counter"><span className="cur">01</span><span>/ 08</span></div>
      <div className="scroll-hint" id="scrollHint">Scroll</div>

      {/* Scroll driver (3d mode) */}
      <div id="track"></div>

      {/* STAGE */}
      <div id="stage">
        <div id="drum">

          {/* 0 / HERO — oferta produktów: planeta z pierścieniem, na którym siedzą produkty
              aktywnej grupy. Grupy przełącza się same co 5 s (planeta się obraca) albo ręcznie;
              ręczne kliknięcie zatrzymuje automat. */}
          <section className="slide" id="start">
            <div className="hero-bg-text" data-edit="hero_bgtext">INFINITI</div>
            <div className="slide-inner hero-content">
             <div className="hero-grid">
              <div className="hero-col">
              <h1 className="hero-h1 rv rv1" data-edit="hero_h1" data-edit-type="html">Gotowe wdrożenia AI dla czterech obszarów Twojej firmy.</h1>
              <p className="hero-sub rv rv2" data-edit="hero_sub" data-edit-type="html">
                Marketing, sprzedaż, obsługa klienta, operacje. Wybierz obszar, w którym tracisz
                najwięcej czasu i pieniędzy — pokażemy, co przejmie AI.
              </p>


              </div>

              <div className="pl-stage rv rv4" id="plStage">
                <canvas className="pl-canvas" id="plCanvas" aria-hidden="true"></canvas>
                {/* podpisy wycinków — widoczne zawsze, aktywny się rozświetla */}
                <div className="pl-glabels" id="plLabels">
                  <div className="pl-gname" data-g="a">Marketing i treści</div>
                  <div className="pl-gname" data-g="b">Sprzedaż</div>
                  <div className="pl-gname" data-g="c">Agenci i obsługa klienta</div>
                  <div className="pl-gname" data-g="d">Operacje i zarządzanie</div>
                </div>
                <div className="pl-nodes" id="plNodes">
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="a" data-i="0">
                    <div className="pl-top"><ProductIcon id={1} /><span className="pl-num">01</span></div>
                    <b className="pl-name">Fabryka Kontentu</b>
                    <i className="pl-desc">Copy i grafiki w tonie marki, z planem na miesiąc.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="a" data-i="1">
                    <div className="pl-top"><ProductIcon id={2} /><span className="pl-num">02</span></div>
                    <b className="pl-name">SEO &amp; GEO Autopilot</b>
                    <i className="pl-desc">Auto-blog pod Google i widoczność w odpowiedziach AI.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="a" data-i="2">
                    <div className="pl-top"><ProductIcon id={3} /><span className="pl-num">03</span></div>
                    <b className="pl-name">AI Reputation Guard</b>
                    <i className="pl-desc">Monitoring i obsługa opinii głosem marki.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="b" data-i="3">
                    <div className="pl-top"><ProductIcon id={4} /><span className="pl-num">04</span></div>
                    <b className="pl-name">AI Łowca Leadów</b>
                    <i className="pl-desc">Autonomiczne pozyskiwanie leadów w wielu kanałach.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="b" data-i="4">
                    <div className="pl-top"><ProductIcon id={5} /><span className="pl-num">05</span></div>
                    <b className="pl-name">AI CRM</b>
                    <i className="pl-desc">Więcej niż CRM: strategia relacji i kontrola 100% rozmów.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="b" data-i="5">
                    <div className="pl-top"><ProductIcon id={6} /><span className="pl-num">06</span></div>
                    <b className="pl-name">AI Generator Ofert</b>
                    <i className="pl-desc">Oferta z briefu w minuty, z trackingiem i follow-upem.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="b" data-i="6">
                    <div className="pl-top"><ProductIcon id={7} /><span className="pl-num">07</span></div>
                    <b className="pl-name">Loyalty Engine</b>
                    <i className="pl-desc">Własna aplikacja lojalnościowa z gamifikacją i AI push.</i>
                  </div>
                  <a className="pl-node has-page" href="/agenci-ai" data-wipe data-g="c" data-i="7">
                    <div className="pl-top"><ProductIcon id={8} /><span className="pl-num">08</span><i className="pl-go" aria-hidden="true">→</i></div>
                    <b className="pl-name">AI Sprzedawca</b>
                    <i className="pl-desc">Pierwsza linia: łapie zapytanie w sekundę i domyka.</i>
                  </a>
                  <a className="pl-node has-page" href="/agenci-ai" data-wipe data-g="c" data-i="8">
                    <div className="pl-top"><ProductIcon id={9} /><span className="pl-num">09</span><i className="pl-go" aria-hidden="true">→</i></div>
                    <b className="pl-name">AI Doradca</b>
                    <i className="pl-desc">Dobiera wariant, rozbraja wątpliwości, prowadzi do zakupu.</i>
                  </a>
                  <a className="pl-node has-page" href="/agenci-ai" data-wipe data-g="c" data-i="9">
                    <div className="pl-top"><ProductIcon id={10} /><span className="pl-num">10</span><i className="pl-go" aria-hidden="true">→</i></div>
                    <b className="pl-name">AI Recepcja 24/7</b>
                    <i className="pl-desc">Odbiera telefon o każdej porze, umawia i pilnuje kalendarza.</i>
                  </a>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="10">
                    <div className="pl-top"><ProductIcon id={11} /><span className="pl-num">11</span></div>
                    <b className="pl-name">AI Data Hub</b>
                    <i className="pl-desc">Rozmawiaj z danymi firmy: odpowiedź, wykres albo akcja.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="11">
                    <div className="pl-top"><ProductIcon id={12} /><span className="pl-num">12</span></div>
                    <b className="pl-name">Inteligentny Magazyn</b>
                    <i className="pl-desc">AI przejmuje zakupy i stany magazynowe.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="12">
                    <div className="pl-top"><ProductIcon id={13} /><span className="pl-num">13</span></div>
                    <b className="pl-name">Market Radar</b>
                    <i className="pl-desc">Wywiad rynkowy: konkurencja, popyt i warstwa cenowa.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="13">
                    <div className="pl-top"><ProductIcon id={14} /><span className="pl-num">14</span></div>
                    <b className="pl-name">AI Project Manager</b>
                    <i className="pl-desc">Twój projekt manager AI.</i>
                  </div>
                  <a className="pl-node has-page" href="/agenci-ai" data-wipe data-g="d" data-i="14">
                    <div className="pl-top"><ProductIcon id={15} /><span className="pl-num">15</span><i className="pl-go" aria-hidden="true">→</i></div>
                    <b className="pl-name">AI Asystent</b>
                    <i className="pl-desc">Baza wiedzy firmy: zespół pyta, asystent odpowiada.</i>
                  </a>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="15">
                    <div className="pl-top"><ProductIcon id={16} /><span className="pl-num">16</span></div>
                    <b className="pl-name">Rekruter AI</b>
                    <i className="pl-desc">Od CV do pierwszego dnia: screening, ranking, rozmowa.</i>
                  </div>
                  <div className="pl-node" role="button" tabIndex={0} data-goto="1" data-g="d" data-i="16">
                    <div className="pl-top"><ProductIcon id={17} /><span className="pl-num">17</span></div>
                    <b className="pl-name">AI Academy</b>
                    <i className="pl-desc">Onboarding, kursy, testy i certyfikaty z wiedzy firmy.</i>
                  </div>
                </div>
              </div>

              <div className="hero-actions rv rv5">
                <a href="#audyt" className="btn-primary" data-goto="1" data-edit="hero_btn_primary">Darmowy audyt AI</a>
                <div className="hero-cta-note" data-hideable="hero:cta-note" data-hide-label="Hero — podpis pod CTA" data-edit="hero_cta_note" data-edit-type="html">Bezpłatna diagnoza · 3 minuty · konkretne rozwiązania i widełki cenowe</div>
              </div>
             </div>
            </div>
          </section>

          {/* 1 / AUDYT — darmowy audyt AI zaraz po hero:
              lewa kolumna tłumaczy, czym to jest i co klient dostaje, prawa to formularz. */}
          <section className="slide" id="audyt" data-hideable="sec:audyt" data-hide-label="Sekcja — Darmowy audyt">
            <div className="slide-inner">
              <div className="aud-grid">
                <div className="aud-left">
                  <div className="section-label rv rv1" data-edit="aud_label">01 — Darmowy audyt AI</div>
                  <h2 className="aud-h2 rv rv2" data-edit="aud_h2" data-edit-type="html">Zacznijmy od <em>diagnozy</em>,<br />nie od faktury.</h2>
                  <p className="aud-lead rv rv3" data-edit="aud_p">
                    Darmowy audyt AI to raport o tym, jak Waszą firmę widzi dziś internet: wyszukiwarka Google,
                    modele AI w rodzaju ChatGPT i Perplexity oraz Wasza konkurencja. Zostawiacie e-mail i adres strony,
                    resztę robi nasz system — raport przychodzi mailem, zwykle w kilka minut.
                  </p>
                </div>

                <div className="aud-listw" data-hideable="aud:list" data-hide-label="Audyt — lista punktów">
                  <div className="aud-list rv rv4">
                    <div className="aud-b">
                      <span className="aud-b-n">01</span>
                      <div className="aud-b-t">
                        <h3 data-edit="aud_b1_h">Widoczność w Google i w AI</h3>
                        <p data-edit="aud_b1_p">Czy wyszukiwarka i modele językowe w ogóle rozumieją, czym się zajmujecie — i co im to utrudnia.</p>
                      </div>
                    </div>
                    <div className="aud-b">
                      <span className="aud-b-n">02</span>
                      <div className="aud-b-t">
                        <h3 data-edit="aud_b2_h">Technika i szybkość strony</h3>
                        <p data-edit="aud_b2_p">Realny pomiar PageSpeed i Core Web Vitals plus lista rzeczy, które zniechęcają klienta i robota.</p>
                      </div>
                    </div>
                    <div className="aud-b">
                      <span className="aud-b-n">03</span>
                      <div className="aud-b-t">
                        <h3 data-edit="aud_b3_h">Konkurencja bez ściemy</h3>
                        <p data-edit="aud_b3_p">Wyszukujemy Waszych realnych konkurentów w sieci i porównujemy sygnał po sygnale — nie z pamięci modelu.</p>
                      </div>
                    </div>
                    <div className="aud-b">
                      <span className="aud-b-n">04</span>
                      <div className="aud-b-t">
                        <h3 data-edit="aud_b4_h">Plan i konkretna wycena</h3>
                        <p data-edit="aud_b4_p">Kroki na najbliższe tygodnie i produkty AI dobrane do Waszej sytuacji — z cenami wdrożenia i abonamentu.</p>
                      </div>
                    </div>
                  </div>
                  <div className="aud-meta rv rv5" data-edit="aud_meta">Za darmo · bez zobowiązań · bez newslettera</div>
                </div>

                <div className="aud-right rv rv4">
                  <AuditForm />
                  <a href="/kontakt" data-wipe className="cta-alt aud-alt" data-edit="aud_alt">Wolisz najpierw porozmawiać? Umów briefing →</a>
                  <div className="aud-note" data-hideable="aud:note" data-hide-label="Audyt — podpis pod formularzem" data-edit="aud_note">Raport gotowy w kilka minut · odzywamy się w ciągu 24 h roboczych</div>
                </div>
              </div>
            </div>
          </section>

          {/* 2 / WHAT */}
          <section className="slide" id="czym-jestesmy" data-hideable="sec:czym-jestesmy" data-hide-label="Sekcja — Czym jesteśmy">
            <div className="slide-inner">
              <div className="what-grid">
                <div className="what-head">
                  <div className="what-left">
                    <div className="section-label rv rv1" data-edit="what_label">02 — Czym jesteśmy</div>
                    <h2 className="rv rv2" data-edit="what_h2" data-edit-type="html">Agencja<br />AI-native.<br />Tylko.</h2>
                  </div>
                  <div className="what-lead rv rv3">
                    <p data-edit="what_p1">
                      Większość agencji mówi, że „używa AI". My jesteśmy z AI zbudowani.
                      Każdy proces, każda strategia, każdy system komunikacji — zaprojektowane
                      z myślą o możliwościach, które AI otwiera, a nie tych, które ogranicza.
                    </p>
                    <p data-edit="what_p2">
                      To nie kwestia narzędzi. To fundamentalna różnica w sposobie myślenia
                      o marketingu, treści i brandzie w erze generatywnej.
                    </p>
                  </div>
                </div>
                <div className="what-board">
                  <div className="diff-item rv rv3">
                    <div className="diff-num">01</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff1_h">AI-native, nie AI-assisted</h3>
                      <p data-edit="what_diff1_p">Nie doklejamy AI do sprawdzonych metod. Budujemy od zera modele operacyjne, w których AI jest rdzeniem, a nie dodatkiem.</p>
                    </div>
                  </div>
                  <div className="diff-item rv rv4">
                    <div className="diff-num">02</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff2_h">Strategia, nie prompt-crafting</h3>
                      <p data-edit="what_diff2_p">Nasz wkład to architektura systemów komunikacji. Generatywna egzekucja jest ich konsekwencją, nie punktem wyjścia.</p>
                    </div>
                  </div>
                  <div className="diff-item rv rv5">
                    <div className="diff-num">03</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff3_h">Wyłącznie retainer</h3>
                      <p data-edit="what_diff3_p">Pracujemy tylko w modelu długoterminowego partnerstwa. Prawdziwa transformacja AI zajmuje miesiące, nie tygodnie.</p>
                    </div>
                  </div>
                  <div className="diff-item rv rv5">
                    <div className="diff-num">04</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff4_h">Danych, umysłu, egzekucji</h3>
                      <p data-edit="what_diff4_p">Data driven. Mind created. AI executed. Trzy filary każdego projektu — równoważne, wzajemnie zależne.</p>
                    </div>
                  </div>
                  <div className="diff-item rv rv5">
                    <div className="diff-num">05</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff5_h">Marka, która sprzedaje</h3>
                      <p data-edit="what_diff5_p">Brand awareness, który buduje rozpoznawalność i wspiera konwersję, a nie żyje obok niej.</p>
                    </div>
                  </div>
                  <div className="diff-item rv rv6">
                    <div className="diff-num">06</div>
                    <div className="diff-text">
                      <h3 data-edit="what_diff6_h">Wszystko mierzalne</h3>
                      <p data-edit="what_diff6_p">Dashboard od wydatku do przychodu. Zawsze wiesz, za co płacisz i co to dało.</p>
                    </div>
                  </div>
                  <div className="what-media rv rv6" id="whatMedia" data-hideable="what:media" data-hide-label="Czym jesteśmy — wizual">
                    <img className="wm-src" src="/assets/img/what-visual.jpg" alt="Neuronowy rdzeń AI — Fastline InfinitiQ" data-edit="what_visual" data-edit-type="image" />
                    <div className="wm-strips" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, i) => (
                        <span className="wm-s" key={i} style={{ '--i': i }}></span>
                      ))}
                    </div>
                    <span className="wm-scan" aria-hidden="true"></span>
                    <span className="wm-tag" data-edit="what_media_tag">● FIQ // Neural Core</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2 / SERVICES */}
          <section className="slide" id="oferta" data-hideable="sec:oferta" data-hide-label="Sekcja — Mapa procesu">
            <div className="slide-inner">
              <div className="services-head">
                <div>
                  <div className="section-label rv rv1" data-edit="svc_label">03 — jak pracujemy</div>
                  <h2 className="rv rv2" data-edit="svc_h2">Mapa procesu.</h2>
                </div>
                <div className="svc-hint rv rv3" data-edit="svc_hint">Każde działanie ma przełożyć się na liczbę, którą widzi Twój zarząd.</div>
              </div>
              <div className="svc-wrap rv rv3">
                <div className="svc-list" id="svcList" data-list="svc">
                  {[
                    { demo: 'strategy', name: 'Discover rozpoznanie', desc: 'Zanim wydasz pierwszą złotówkę, wiemy, czy i gdzie warto grać. Analizujemy rynek, konkurencję i Twojego klienta, opieramy decyzje o twarde benchmarki.', foot: 'Czego klasyczna agencja nie robi w ogóle.', chips: [['Market Radar', 'analiza rynku'], ['Benchmarks', 'benchmarki'], ['Rival Map', 'konkurencja'], ['ICP Decode', 'analiza TG']] },
                    { demo: 'gen', name: 'Define strategia', desc: 'Tu powstaje plan wzrostu. To praca agencji strategicznej w pełnej skali: ustalamy, co sprzedajemy i w jakiej cenie, budujemy pozycjonowanie i platformę marki, projektujemy spójny system komunikacji oraz lejek, który zamienia uwagę w sprzedaż.', foot: 'Tu rodzi się lejek i obietnica marki.', chips: [['Offer Design', 'strategia produktu'], ['Brand Core', 'platforma marki'], ['Comms Engine', 'komunikacja'], ['Funnel Design', 'lejek']] },
                    { demo: 'voice', name: 'Create kreacja i realizacja', desc: 'Tu dział kreatywny zamienia strategię w kampanie, które działają. Koncepcja, key visuals i narracja, a potem produkcja contentu w skali (AI-native) i wdrożenie na kanałach. Robimy zarówno kampanie brand awareness, jak i, przede wszystkim, leadowe.', foot: 'Jedyny obszar pokrywany przez starą agencję.', chips: [['Creative Lab', 'kreacja'], ['Launch Line', 'realizacja'], ['Lead Engine', 'leady i sprzedaż']] },
                    { demo: 'llm', name: 'Convert sprzedaż i wynik', desc: 'Serce modelu. Optymalizujemy kampanie na żywo, mierzymy ROI od wydatku do przychodu i wspieramy Twój dział sprzedaży. To tutaj bierzemy odpowiedzialność za wynik.', foot: 'Serce modelu — tu bierzemy odpowiedzialność za wynik.', chips: [['Live Ops', 'optymalizacja na żywo'], ['ROI Radar', 'wydatek → przychód'], ['Sales Assist', 'wsparcie handlowców']] },
                    { demo: 'auto', name: 'Grow lojalność i ludzie', desc: 'Prawa strona lejka, gdzie wynik się utrzymuje i rośnie: retencja, programy lojalnościowe, wzrost wartości klienta oraz motywacja zespołów, które dowożą sprzedaż.', foot: 'Prawa strona lejka: wynik się utrzymuje i rośnie.', chips: [['Loyalty Loop', 'retencja i lojalność'], ['LTV Boost', 'wartość klienta w czasie']] },
                  ].map((f, i) => {
                    const sp = f.name.indexOf(' ');
                    return (
                      <div className="svc-row" data-demo={f.demo} style={{ '--i': i }} key={f.demo}>
                        <div className="svc-main">
                          <div className="svc-top">
                            <span className="svc-num">{('0' + (i + 1)).slice(-2)}</span>
                            <span className="svc-title">{sp > 0 ? f.name.slice(0, sp) : f.name}</span>
                            <span className="svc-cap">{sp > 0 ? f.name.slice(sp + 1) : ''}</span>
                            <span className="svc-name" data-edit={`svc${i + 1}_name`}>{f.name}</span>
                          </div>
                          <p className="svc-desc" data-edit={`svc${i + 1}_desc`}>{f.desc}</p>
                          <div className="svc-foot">{f.foot}</div>
                        </div>
                        <div className="svc-side">
                          <span className="svc-chips-src">{f.chips.map(c => c.join(' | ')).join('; ')}</span>
                          <div className="svc-chips" aria-hidden="true">
                            {f.chips.map(c => (
                              <span className="svc-chip" key={c[0]}><b>{c[0]}</b><i>{c[1]}</i></span>
                            ))}
                          </div>
                        </div>
                        <span className="svc-beam" aria-hidden="true"></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 3 / TEAM — cyfrowi pracownicy (облака точек + фото по ховеру) */}

          {/* 4 / MODEL */}
          <section className="slide" id="model" data-hideable="sec:model" data-hide-label="Sekcja — Model współpracy">
            <div className="slide-inner">
              <div className="model-panel rv rv1">
                <div className="model-left">
                  <div className="section-label" data-edit="model_label">04 — Model współpracy</div>
                  <h2 data-edit="model_h2" data-edit-type="html">Tylko<br />retainer.</h2>
                </div>
                <div className="model-right">
                  <p data-edit="model_p1" data-edit-type="html">
                    Nie realizujemy projektów jednorazowych. Nie dlatego, że nie chcemy — ale dlatego,
                    że <strong>prawdziwa wartość AI pojawia się w czasie</strong>. Systemy uczą się, modele dojrzewają,
                    strategie ewoluują.
                  </p>
                  <p data-edit="model_p2">Wybieramy klientów z ambicją na lata, nie tygodnie.</p>
                  <ul className="model-points">
                    <li data-edit="model_point1">Minimalny okres współpracy: 6 miesięcy</li>
                    <li data-edit="model_point2">Dedykowany zespół AI — strategy + execution</li>
                    <li data-edit="model_point3">Regularne przeglądy strategiczne i optymalizacje</li>
                    <li data-edit="model_point4">Dostęp do nowych modeli AI natychmiast po premierze</li>
                    <li data-edit="model_point5">Priorytetowy onboarding dla klientów Fastline Advertising</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 5 / WHO */}
          <section className="slide" id="dla-kogo" data-hideable="sec:dla-kogo" data-hide-label="Sekcja — Co robimy">
            <div className="slide-inner">
              <div className="section-label rv rv1" data-edit="who_label">05 — Co robimy</div>
              <h2 className="who-h2 rv rv2" data-edit="who_h2" data-edit-type="html">Od pierwszego leada po<br />stałego klienta.</h2>
              <div className="who-grid" data-list="who">
                <div className="who-item who-hero rv rv3" data-n="01">
                  <div className="wh-main">
                    <div className="who-tag">Główna specjalizacja</div>
                    <h3 data-edit="who1_h">Kampanie leadowe i sprzedażowe B2B</h3>
                    <p data-edit="who1_p">Sekwencje ABM, lead magnets, landing pages, nurturing i scoring. Cel jest jeden: pipeline i sprzedaż, nie kliknięcia. Generujemy kontakty gotowe do rozmowy handlowej i pilnujemy ich aż do domknięcia.</p>
                    <a className="wh-cta" href="/kontakt" data-wipe>Chcę więcej leadów</a>
                  </div>
                  <div className="wh-stats">
                    <div className="wh-stat"><div className="wh-stat-l">Cel</div><div className="wh-stat-v"><span>pipeline ↑</span><canvas className="wh-spark" aria-hidden="true"></canvas></div></div>
                    <div className="wh-stat"><div className="wh-stat-l">Mierzymy</div><div className="wh-stat-v"><span>koszt / lead</span></div></div>
                  </div>
                </div>
                <div className="who-item rv rv4" data-n="02">
                  <div className="who-tag">Digital</div>
                  <h3 data-edit="who2_h">Kampanie brand awareness</h3>
                  <p data-edit="who2_p">Rozpoznawalność, która pracuje na sprzedaż. Spójna marka w każdym kanale, podpięta pod lejek.</p>
                </div>
                <div className="who-item rv rv4" data-n="03">
                  <div className="who-tag">Produkcja</div>
                  <h3 data-edit="who3_h">Realizacja kampanii</h3>
                  <p data-edit="who3_p">Od konceptu po publikację. Content AI-native: szybciej, więcej i spójnie, na każdy format.</p>
                </div>
                <div className="who-item rv rv5" data-n="04">
                  <div className="who-tag">Relacje</div>
                  <h3 data-edit="who4_h">Eventy B2B</h3>
                  <p data-edit="who4_p">Spotkania, które budują relacje i kontrakty. Format premium nastawiony na konkretny efekt sprzedażowy.</p>
                </div>
                <div className="who-item rv rv5" data-n="05">
                  <div className="who-tag">Sprzedaż</div>
                  <h3 data-edit="who5_h">Programy sprzedażowe</h3>
                  <p data-edit="who5_p">Mechaniki, które motywują handel i przyspieszają domknięcia. Marketing i sales grają do jednej bramki.</p>
                </div>
                <div className="who-item rv rv6" data-n="06">
                  <div className="who-tag">Retencja</div>
                  <h3 data-edit="who6_h">Programy lojalnościowe</h3>
                  <p data-edit="who6_p">Klienci wracają i kupują więcej. Wzrost wartości klienta (CLV), nie tylko pogoń za nowymi.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 6 / PARENT */}
          <section className="slide" id="grupa" data-hideable="sec:grupa" data-hide-label="Sekcja — Greywolf Group">
            <div className="slide-inner">
              <div className="parent-inner">
                <img className="rv rv1" src="/assets/Greywolf/logo_greywolf.png" alt="Greywolf Group" data-edit="parent_logo" data-edit-type="image" />
                <p className="rv rv2" data-edit="parent_p" data-edit-type="html">
                  Fastline InfinitiQ jest częścią <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a> — ekosystemu agencji
                  i kompetencji marketingowych budowanego z myślą o firmach, które chcą więcej niż standardowe usługi.
                  Działamy wspólnie tam, gdzie projekty wymagają synergii kompetencji.
                </p>
                <div className="parent-sign rv rv3" data-edit="parent_sign">Parent company</div>
              </div>
            </div>
          </section>

          {/* 8 / CTA — finał: rozmowa (formularz audytu żyje w sekcji 01) */}
          <section className="slide" id="kontakt" data-hideable="sec:kontakt" data-hide-label="Sekcja — Kontakt">
            <div className="slide-inner cta-slide-inner">
              <div className="cta-bg" data-edit="cta_bg">IQ</div>
              <div className="section-label rv rv1" data-edit="fin_label">06 — Kontakt</div>
              <h2 className="rv rv2" data-edit="fin_h2" data-edit-type="html">Porozmawiajmy o <em>konkretach</em>.</h2>
              <p className="rv rv3" data-edit="fin_p">
                Trzydzieści minut briefingu: pokazujemy, co da się u Was zautomatyzować w pierwszej kolejności,
                ile to kosztuje i co dokładnie zrobimy w pierwszym miesiącu. Bez prezentacji o transformacji cyfrowej.
              </p>
              <a href="/kontakt" data-wipe className="btn-primary rv rv4" data-edit="fin_btn">Umów briefing</a>
              <a href="#audyt" className="cta-alt rv rv5" data-goto="1" data-hideable="fin:alt" data-hide-label="Kontakt — link do audytu" data-edit="fin_alt">Wolisz najpierw twarde dane? Odbierz darmowy audyt →</a>
              <div className="cta-note rv rv5" data-edit="fin_note">Odpowiadamy w ciągu 24 h roboczych</div>
            </div>
            <div className="footer-bar" data-hideable="fin:footer" data-hide-label="Stopka">
              <p data-edit="footer_left" data-edit-type="html">© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
              <p data-edit="footer_right" data-edit-type="html">Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
