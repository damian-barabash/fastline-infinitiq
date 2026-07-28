import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sbPublic } from '../lib/supabase.js';
import auditCss from '../styles/audit.css?inline';

// Публичная страница аудита для клиента (по образцу mayko.rocks/fastline-geo,
// но в графическом стиле FIQ). Данные: public.audits (RLS: аноним видит только ready).
const SCOPE = {
  basic: [
    'Audyt techniczny i naprawa indeksacji',
    'Meta title / description dla kluczowych stron',
    'Dane strukturalne Schema.org (Organization, usługi, FAQ)',
    'Open Graph i podgląd w social / komunikatorach',
    'Mapa strony XML + robots.txt (w tym boty AI)',
    'Optymalizacja szybkości i Core Web Vitals',
  ],
  geo: [
    'Treści pod pytania, które klienci zadają AI',
    'llms.txt i dostęp dla botów AI (GPTBot, ClaudeBot, Perplexity)',
    'Strony odpowiedzi: FAQ + treści eksperckie',
    'Spójne dane firmy w źródłach, z których korzysta AI',
    'Monitoring cytowań w ChatGPT / Gemini / Perplexity',
    'Raport widoczności i plan kolejnych kroków',
  ],
};

const INTENT_LABEL = { informacyjna: 'informacyjna', zakupowa: 'zakupowa', lokalna: 'lokalna', 'porównawcza': 'porównawcza' };

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Audit() {
  const { slug } = useParams();
  const [audit, setAudit] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    document.title = 'Audyt SEO · GEO — Fastline InfinitiQ';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    let alive = true;
    sbPublic().from('audits').select('*').eq('slug', slug).eq('status', 'ready').maybeSingle()
      .then(({ data }) => { if (alive) setAudit(data || null); })
      .catch(() => { if (alive) setAudit(null); });
    return () => { alive = false; meta.remove(); };
  }, [slug]);

  // reveal-анимация секций по скроллу (как rv на лендинге)
  useEffect(() => {
    if (!audit) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('au-vis'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.au-section, .au-hero').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [audit]);

  const c = audit?.content || {};
  const prices = audit?.prices || {};
  const packages = Array.isArray(prices.packages) ? prices.packages : [];
  const hasPrices = packages.some(p => (p.price || '').trim());
  let sectionNo = 0;
  const no = () => String(++sectionNo).padStart(2, '0');

  return (
    <div className="au-page">
      <style dangerouslySetInnerHTML={{ __html: auditCss }} />

      <header className="au-top">
        <img className="au-fiq-logo" src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" />
        <div className="au-top-label">Audyt SEO · GEO</div>
        {audit && <div className="au-top-date">{fmtDate(audit.generated_at || audit.created_at)}</div>}
      </header>

      {audit === undefined && (
        <div className="au-gate">Ładowanie audytu…</div>
      )}
      {audit === null && (
        <div className="au-gate">
          <div className="au-gate-title">Nie znaleziono audytu</div>
          <div>Sprawdź link lub skontaktuj się: <a href="mailto:infinitiq@fastline.pl">infinitiq@fastline.pl</a></div>
        </div>
      )}

      {audit && (
        <main className="au-main">
          {/* HERO */}
          <section className="au-hero">
            <div className="au-hero-bg" aria-hidden="true">AUDYT</div>
            {audit.logo_url && (
              <div className="au-client-logo"><img src={audit.logo_url} alt={audit.client_name} onError={e => { e.target.parentNode.style.display = 'none'; }} /></div>
            )}
            <div className="au-eyebrow">★ Oferta audytu SEO · GEO — {audit.client_name} · ważna 14 dni</div>
            <h1 className="au-h1">{c.hero?.headline || `Widoczność ${audit.client_name} w Google i w AI`}</h1>
            {c.hero?.sub && <p className="au-sub">{c.hero.sub}</p>}
            <div className="au-hero-note">Przygotowane przez Fastline InfinitiQ · AI-Native Agency</div>
          </section>

          {/* DIAGNOZA */}
          {Array.isArray(c.diagnosis) && c.diagnosis.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Jak rozumiemy Waszą sytuację</div>
              <div className="au-grid3">
                {c.diagnosis.map((d, i) => (
                  <div className="au-card" data-n={String(i + 1).padStart(2, '0')} key={i}>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PUNKT WYJŚCIA */}
          {Array.isArray(c.metrics) && c.metrics.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Punkt wyjścia</div>
              <div className="au-metrics">
                {c.metrics.map((m, i) => (
                  <div className="au-metric" key={i}>
                    <div className="au-metric-val">{m.value}</div>
                    <div className="au-metric-label">{m.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ANALIZA +/- */}
          {(Array.isArray(c.plus) || Array.isArray(c.minus)) && (
            <section className="au-section">
              <div className="au-label">{no()} — Analiza obecnego stanu</div>
              <div className="au-pm">
                <div className="au-pm-col">
                  <div className="au-pm-head plus">＋ Na plus</div>
                  {(c.plus || []).map((t, i) => <div className="au-pm-item" key={i}>{t}</div>)}
                </div>
                <div className="au-pm-col">
                  <div className="au-pm-head minus">！ Do poprawy</div>
                  {(c.minus || []).map((t, i) => <div className="au-pm-item" key={i}>{t}</div>)}
                </div>
              </div>
            </section>
          )}

          {/* FRAZY */}
          {Array.isArray(c.keywords) && c.keywords.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Czym szukają Was klienci</div>
              <div className="au-table-wrap">
                <table className="au-table">
                  <thead>
                    <tr><th>Fraza</th><th>Intencja</th><th>Potencjał</th></tr>
                  </thead>
                  <tbody>
                    {c.keywords.map((k, i) => (
                      <tr key={i}>
                        <td>{k.phrase}</td>
                        <td className="au-td-mono">{INTENT_LABEL[k.intent] || k.intent}</td>
                        <td><span className={'au-pot p-' + (k.potential || '')}>{k.potential}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="au-note">Szacunek na podstawie analizy AI — pełne wolumeny dostarczamy po podpięciu narzędzi w etapie 1.</div>
            </section>
          )}

          {/* PROMPTY AI */}
          {Array.isArray(c.ai_prompts) && c.ai_prompts.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Jak klienci pytają AI</div>
              <p className="au-p">Coraz więcej decyzji zakupowych zaczyna się nie w Google, a w ChatGPT, Gemini czy Perplexity. Tak wyglądają realne pytania w Waszej branży:</p>
              <div className="au-prompts">
                {c.ai_prompts.map((g, i) => (
                  <div className="au-prompt-group" key={i}>
                    <div className="au-prompt-cat">{g.category}</div>
                    {(g.prompts || []).map((p, k) => <div className="au-prompt" key={k}>„{p}"</div>)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DLACZEGO TERAZ */}
          {Array.isArray(c.why_now) && c.why_now.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Dlaczego warto teraz</div>
              <div className="au-grid3">
                {c.why_now.map((d, i) => (
                  <div className="au-card" data-n={String(i + 1).padStart(2, '0')} key={i}>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PLAN */}
          {Array.isArray(c.plan) && c.plan.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Plan działania</div>
              <div className="au-plan">
                {c.plan.map((s, i) => (
                  <div className="au-step" key={i}>
                    <div className="au-step-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="au-step-body">
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                      {s.effect && <div className="au-step-effect">→ {s.effect}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* USŁUGI AI DLA KLIENTA */}
          {Array.isArray(c.ai_services) && c.ai_services.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Co możemy zbudować z AI dla {audit.client_name}</div>
              <p className="au-p">Poza widocznością w Google i AI jesteśmy agencją AI-native — projektujemy i wdrażamy systemy, które pracują w Waszym biznesie na co dzień. Dopasowane do Waszej branży:</p>
              <div className="au-services">
                {c.ai_services.map((s, i) => (
                  <div className="au-service" key={i}>
                    <div className="au-service-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="au-service-body">
                      <h3>{s.name}</h3>
                      <p>{s.desc}</p>
                      {s.effect && <div className="au-service-effect">→ {s.effect}</div>}
                      {s.example && <div className="au-service-example">Przykład: {s.example}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ZAKRES I INWESTYCJA */}
          <section className="au-section">
            <div className="au-label">{no()} — Zakres i inwestycja</div>
            <div className="au-scope">
              <div className="au-scope-col">
                <div className="au-scope-head">Fundament techniczny</div>
                {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
              </div>
              <div className="au-scope-col">
                <div className="au-scope-head">Widoczność w AI (GEO)</div>
                {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
              </div>
            </div>
            <div className="au-packages">
              {(packages.length ? packages : [{ name: 'Podstawowy' }, { name: 'Standard' }, { name: 'Premium' }]).map((p, i) => (
                <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={i}>
                  {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                  <div className="au-pack-name">{p.name}</div>
                  <div className="au-pack-price">{(p.price || '').trim() || 'wycena indywidualna'}</div>
                </div>
              ))}
            </div>
            {prices.note && <div className="au-note">{prices.note}</div>}
            {!hasPrices && <div className="au-note">Szczegółową wycenę przedstawiamy po rozmowie — zakres dopasowujemy do celów.</div>}
          </section>

          {/* FAQ */}
          {Array.isArray(c.faq) && c.faq.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Najczęstsze pytania</div>
              <div className="au-faq">
                {c.faq.map((f, i) => (
                  <details className="au-faq-item" key={i}>
                    <summary>{f.q}<span className="au-faq-plus">＋</span></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* KONTAKT */}
          <section className="au-section au-contact">
            <div className="au-label">{no()} — Co dalej</div>
            <h2 className="au-h2">Porozmawiajmy o wdrożeniu.</h2>
            <p className="au-p">Odpowiemy na pytania, doprecyzujemy zakres i ustalimy start. Pierwsza rozmowa — bez zobowiązań.</p>
            <a className="au-cta" href="mailto:infinitiq@fastline.pl?subject=Audyt%20SEO%20%C2%B7%20GEO">Napisz do nas → infinitiq@fastline.pl</a>
          </section>

          <footer className="au-footer">
            <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
            <p>Data driven. Mind created. <span className="au-acc">AI executed.</span></p>
          </footer>
        </main>
      )}
    </div>
  );
}
