import React from 'react';

// Разметка главной 1:1 из index.html (те же классы/ids/data-атрибуты).
// Используется главной (с 3D-движком) и редактором (mode-flat).
// Внутренние ссылки: href на роуты + data-wipe (перехват в движке).
export default function LandingShell() {
  return (
    <>
      <canvas id="neural"></canvas>
      <div className="cursor-dot" id="cursorDot"></div>
      <div className="cursor-ring" id="cursorRing"></div>

      {/* NAV */}
      <nav>
        <a className="nav-logo" href="#" id="navHome" aria-label="Fastline InfinitiQ">
          <img src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" data-edit="nav_logo" data-edit-type="image" />
        </a>
        <a href="/kontakt" data-wipe className="nav-cta"><span className="cta-full" data-edit="nav_cta_full">Umów briefing</span><span className="cta-short" data-edit="nav_cta_short">Briefing</span></a>
      </nav>

      {/* PROGRESS RAIL */}
      <div className="rail" id="rail" role="navigation" aria-label="Sekcje">
        <button className="rail-item" data-i="0"><span className="rail-name">Start</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="1"><span className="rail-name">Czym jesteśmy</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="2"><span className="rail-name">Oferta</span><span className="rail-tick"></span></button>
        <button className="rail-item" data-i="3"><span className="rail-name">Produkt</span><span className="rail-tick"></span></button>
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

          {/* 0 / HERO */}
          <section className="slide" id="start">
            <div className="hero-bg-text" data-edit="hero_bgtext">INFINITI</div>
            <div className="slide-inner hero-content">
              <div className="hero-claim rv rv1" id="heroClaim">
                <span className="hc-word" data-edit="hero_claim_1">Data driven.</span>
                <span className="hc-sep" aria-hidden="true"></span>
                <span className="hc-word" data-edit="hero_claim_2">Mind created.</span>
                <span className="hc-sep" aria-hidden="true"></span>
                <span className="hc-word" data-edit="hero_claim_3">Unique executed.</span>
              </div>
              <div className="hero-eyebrow rv rv1" data-edit="hero_eyebrow">★ AI-Native Agency — Retainer Only</div>
              <h1 className="hero-h1 rv rv2" data-edit="hero_h1" data-edit-type="html">Nie używamy AI.<br />Myślimy <em>przez AI.</em></h1>
              <p className="hero-sub rv rv3" data-edit="hero_sub" data-edit-type="html">
                Fastline InfinitiQ to agencja zbudowana od zera wokół sztucznej inteligencji.{' '}
                <strong>Nie wdrażamy AI do starych procesów.</strong>{' '}
                Projektujemy strategie, treści i systemy komunikacji, które bez AI nie byłyby możliwe.
              </p>
              <div className="hero-actions rv rv4">
                <a href="/kontakt" data-wipe className="btn-primary" data-edit="hero_btn_primary">Zacznij współpracę</a>
                <a href="#czym-jestesmy" className="btn-ghost" data-goto="1" data-edit="hero_btn_ghost">Dowiedz się więcej</a>
              </div>
            </div>
            <div className="ticker">
              <div className="ticker-inner">
                <span className="ticker-item"><span>★</span> AI Strategy</span>
                <span className="ticker-item"><span>★</span> Generative Content</span>
                <span className="ticker-item"><span>★</span> Brand Voice AI</span>
                <span className="ticker-item"><span>★</span> LLM Integration</span>
                <span className="ticker-item"><span>★</span> Marketing Automation AI</span>
                <span className="ticker-item"><span>★</span> CRM &amp; Sales AI</span>
                <span className="ticker-item"><span>★</span> Performance Marketing AI</span>
                <span className="ticker-item"><span>★</span> AI Video &amp; Visual Production</span>
                <span className="ticker-item"><span>★</span> AI Strategy</span>
                <span className="ticker-item"><span>★</span> Generative Content</span>
                <span className="ticker-item"><span>★</span> Brand Voice AI</span>
                <span className="ticker-item"><span>★</span> LLM Integration</span>
                <span className="ticker-item"><span>★</span> Marketing Automation AI</span>
                <span className="ticker-item"><span>★</span> CRM &amp; Sales AI</span>
                <span className="ticker-item"><span>★</span> Performance Marketing AI</span>
                <span className="ticker-item"><span>★</span> AI Video &amp; Visual Production</span>
              </div>
            </div>
          </section>

          {/* 1 / WHAT */}
          <section className="slide" id="czym-jestesmy" data-hideable="sec:czym-jestesmy">
            <div className="slide-inner">
              <div className="what-grid">
                <div className="what-head">
                  <div className="what-left">
                    <div className="section-label rv rv1" data-edit="what_label">01 — Czym jesteśmy</div>
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
                  <div className="what-media rv rv6" id="whatMedia">
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
          <section className="slide" id="oferta" data-hideable="sec:oferta">
            <div className="slide-inner">
              <div className="services-head">
                <div>
                  <div className="section-label rv rv1" data-edit="svc_label">02 — jak pracujemy</div>
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
          <section className="slide" id="zespol" data-hideable="sec:zespol">
            <div className="slide-inner">
              <div className="team-head">
                <div>
                  <div className="section-label rv rv1" data-edit="team_label">03 — Produkt #1</div>
                  <h2 className="rv rv2" data-edit="team_h2" data-edit-type="html">Cyfrowi pracownicy.<br />Produkt, nie eksperyment.</h2>
                </div>
                <div className="team-hint rv rv3" data-edit="team_hint">{'// najedź lub dotknij — poznaj zespół'}</div>
              </div>
              <p className="team-lead rv rv3" data-edit="team_lead">
                Nasz pierwszy produkt: zespół agentów AI wytrenowanych na Twojej ofercie, procesach i języku marki.
                Wdrożenie liczone w tygodniach — bez rekrutacji, bez drugiej zmiany, bez rotacji. Każdy z nich
                odpowiada za inny etap kontaktu z klientem i pracuje wtedy, kiedy konkurencja już nie odbiera.
              </p>
              <div className="team-grid rv rv4" id="teamGrid">

                <article className="team-card" tabIndex={0} data-team="1">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/natalia.webp" alt="Natalia — asystentka AI Fastline InfinitiQ" data-edit="team1_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="team1_badge">● online 24/7</span>
                  </div>
                  <div className="tm-body">
                    <div className="tm-role" data-edit="team1_role">Asystentka AI — wsparcie zespołu</div>
                    <h3 className="tm-name" data-edit="team1_name">Natalia</h3>
                    <p className="tm-desc" data-edit="team1_desc">
                      Pamięć operacyjna Twojej firmy. Zna procedury, ustalenia i historię klientów —
                      w trakcie rozmowy podpowiada zespołowi, co zaproponować i o czym nie zapomnieć.
                      Wdrożenie nowej osoby skraca z tygodni do dni.
                    </p>
                    <div className="tm-meta" data-edit="team1_meta">wiedza firmowa · procedury · onboarding</div>
                  </div>
                </article>

                <article className="team-card" tabIndex={0} data-team="2">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/kacper.webp" alt="Kacper — agent sprzedaży AI Fastline InfinitiQ" data-edit="team2_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="team2_badge">● pierwsza linia</span>
                  </div>
                  <div className="tm-body">
                    <div className="tm-role" data-edit="team2_role">Agent sprzedaży — social media i telefon</div>
                    <h3 className="tm-name" data-edit="team2_name">Kacper</h3>
                    <p className="tm-desc" data-edit="team2_desc">
                      Pierwsza linia sprzedaży. Odpisuje w social mediach, oddzwania na zapytania
                      i prowadzi rozmowę aż do decyzji — w Twoim brand voice, z pełnym kontekstem oferty.
                      Żaden lead nie czeka do rana i nie ginie w weekend.
                    </p>
                    <div className="tm-meta" data-edit="team2_meta">social · telefon · kwalifikacja leadów</div>
                  </div>
                </article>

                <article className="team-card" tabIndex={0} data-team="3">
                  <div className="tm-visual">
                    <canvas className="tm-canvas" aria-hidden="true"></canvas>
                    <img className="tm-photo" src="/assets/team/maja.webp" alt="Maja — doradczyni klienta AI Fastline InfinitiQ" data-edit="team3_photo" data-edit-type="image" />
                    <span className="tm-frame" aria-hidden="true"></span>
                    <span className="tm-badge" data-edit="team3_badge">● doradztwo</span>
                  </div>
                  <div className="tm-body">
                    <div className="tm-role" data-edit="team3_role">Doradczyni klienta — oferta i wdrożenie</div>
                    <h3 className="tm-name" data-edit="team3_name">Maja</h3>
                    <p className="tm-desc" data-edit="team3_desc">
                      Tłumaczy ofertę na język decyzji. Prowadzi klienta przez zakres, warianty
                      i kolejne kroki wdrożenia, dobiera pakiet do realnej skali potrzeb i domyka pytania,
                      które zwykle zostają bez odpowiedzi.
                    </p>
                    <div className="tm-meta" data-edit="team3_meta">zakres · warianty · wdrożenie</div>
                  </div>
                </article>

              </div>
            </div>
          </section>

          {/* 4 / MODEL */}
          <section className="slide" id="model" data-hideable="sec:model">
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
          <section className="slide" id="dla-kogo" data-hideable="sec:dla-kogo">
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
          <section className="slide" id="grupa" data-hideable="sec:grupa">
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

          {/* 7 / CTA */}
          <section className="slide" id="kontakt" data-hideable="sec:kontakt">
            <div className="slide-inner cta-slide-inner">
              <div className="cta-bg" data-edit="cta_bg">IQ</div>
              <div className="section-label rv rv1" data-edit="cta_label">06 — Zacznij</div>
              <h2 className="rv rv2" data-edit="cta_h2" data-edit-type="html">Gotowi<br />na <em>AI-native?</em></h2>
              <p className="rv rv3" data-edit="cta_p">
                Pierwsze spotkanie to briefing strategiczny — bez umów, bez zobowiązań.
                Sprawdzamy, czy do siebie pasujemy.
              </p>
              <a href="/kontakt" data-wipe className="btn-primary rv rv4" data-edit="cta_btn">Umów briefing strategiczny</a>
              <div className="cta-note rv rv5" data-edit="cta_note">Odpowiadamy w 24h roboczych</div>
            </div>
            <div className="footer-bar">
              <p data-edit="footer_left" data-edit-type="html">© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
              <p data-edit="footer_right" data-edit-type="html">Data driven. Mind created. <span style={{ color: 'var(--green)' }}>AI executed.</span></p>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
