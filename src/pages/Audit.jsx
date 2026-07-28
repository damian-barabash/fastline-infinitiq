import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sbPublic } from '../lib/supabase.js';
import { Ic, Gauge, GrowthDeco, serviceIcon } from '../components/auditIcons.jsx';
import auditCss from '../styles/audit.css?inline';

// Публичная страница аудита для клиента (по образцу mayko.rocks/fastline-geo,
// но в графическом стиле FIQ). Данные: public.audits (RLS: аноним видит только ready).
// Правило: никакого «голого текста» — каждая секция несёт граф-элемент
// (иконки, шкалы, бары, таймлайн, пузыри, декоративный график).
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

const DIAG_ICONS = ['search', 'eye', 'layers'];
const WHY_ICONS = ['bolt', 'rocket', 'clock'];
const POT_W = { wysoki: 100, 'średni': 62, sredni: 62, niski: 30 };

// фильтры пустых элементов (модель может вернуть незаполненный объект)
const nzObj = (a) => Array.isArray(a) ? a.filter(x => x && Object.values(x).some(v => String(v || '').trim())) : [];
const nzStr = (a) => Array.isArray(a) ? a.filter(s => String(s || '').trim()) : [];

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
  const packages = (Array.isArray(prices.packages) ? prices.packages : []).filter(p => (p.name || '').trim());
  const hasPrices = packages.some(p => (p.price || '').trim());
  const diagnosis = nzObj(c.diagnosis);
  const metrics = nzObj(c.metrics);
  const plus = nzStr(c.plus);
  const minus = nzStr(c.minus);
  const keywords = nzObj(c.keywords);
  const aiPrompts = nzObj(c.ai_prompts).map(g => ({ ...g, prompts: nzStr(g.prompts) })).filter(g => g.prompts.length);
  const whyNow = nzObj(c.why_now);
  const plan = nzObj(c.plan);
  const services = nzObj(c.ai_services);
  const faq = nzObj(c.faq).filter(f => (f.q || '').trim() && (f.a || '').trim());
  const scores = c.scores && typeof c.scores === 'object' ? c.scores : null;
  const competitors = nzObj(c.competitors);
  const lostQueries = nzObj(c.lost_queries);
  const speedTips = nzStr(c.speed_tips);
  const recs = nzObj(c.recommendations);
  const speed = c.speed && typeof c.speed === 'object' ? c.speed : null;
  const psi = speed?.psi || null;
  const perf = speed?.local || null;
  // оценка метрики Core Web Vitals: good / mid / poor
  const rate = (v, good, poor) => v == null ? '' : v <= good ? ' m-good' : v <= poor ? ' m-mid' : ' m-poor';

  // тема в цветах сайта клиента (site_meta.theme из edge); нет темы → FIQ-дефолт
  const hexRgb = (h) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(h || '').trim());
    return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) } : null;
  };
  const theme = audit?.site_meta?.theme || null;
  let themeStyle;
  if (theme) {
    const bg = hexRgb(theme.bg), acc = hexRgb(theme.accent);
    if (bg && acc) {
      const lumOf = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
      const fgHex = hexRgb(theme.fg) ? theme.fg : (lumOf(bg) > 0.5 ? '#141414' : '#F5F5F0');
      const fg = hexRgb(fgHex);
      themeStyle = {
        '--bg': theme.bg, '--bg-rgb': `${bg.r}, ${bg.g}, ${bg.b}`,
        '--fg': fgHex, '--fg-rgb': `${fg.r}, ${fg.g}, ${fg.b}`,
        '--acc': theme.accent, '--acc-rgb': `${acc.r}, ${acc.g}, ${acc.b}`,
        '--acc-ink': lumOf(acc) > 0.5 ? '#0D0D0D' : '#FFFFFF',
      };
    }
  }
  let sectionNo = 0;
  const no = () => String(++sectionNo).padStart(2, '0');

  return (
    <div className="au-page" style={themeStyle}>
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
            {scores && (
              <div className="au-gauges">
                <Gauge value={scores.google} label="Widoczność Google" />
                <Gauge value={scores.ai} label="Widoczność w AI" />
                <Gauge value={scores.technika} label="Technika strony" />
                <Gauge value={scores.tresc} label="Jakość treści" />
              </div>
            )}
            <div className="au-hero-note">Przygotowane przez Fastline InfinitiQ · AI-Native Agency</div>
          </section>

          {/* DIAGNOZA */}
          {diagnosis.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Jak rozumiemy Waszą sytuację</div>
              <div className="au-grid3">
                {diagnosis.map((d, i) => (
                  <div className="au-card" key={i}>
                    <div className="au-card-ic"><Ic name={DIAG_ICONS[i % DIAG_ICONS.length]} /></div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PUNKT WYJŚCIA */}
          {metrics.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Punkt wyjścia</div>
              <div className="au-metrics">
                {metrics.map((m, i) => {
                  const bad = /brak|nie|false|0/i.test(String(m.value || ''));
                  return (
                    <div className={'au-metric' + (bad ? ' bad' : ' good')} key={i}>
                      <div className="au-metric-ic"><Ic name={bad ? 'bolt' : 'shield'} size={18} /></div>
                      <div className="au-metric-val">{m.value}</div>
                      <div className="au-metric-label">{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ANALIZA +/- */}
          {(plus.length > 0 || minus.length > 0) && (
            <section className="au-section">
              <div className="au-label">{no()} — Analiza obecnego stanu</div>
              <div className="au-pm">
                <div className="au-pm-col">
                  <div className="au-pm-head plus"><Ic name="shield" size={16} /> Na plus</div>
                  {plus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark ok" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" /><path d="M6 10.5l2.6 2.6L14 7.5" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="au-pm-col">
                  <div className="au-pm-head minus"><Ic name="bolt" size={16} /> Do poprawy</div>
                  {minus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark warn" viewBox="0 0 20 20"><path d="M10 2l8.5 15h-17z" /><path d="M10 8v4.4" /><circle cx="10" cy="14.6" r="0.9" fill="currentColor" stroke="none" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SZYBKOŚĆ STRONY */}
          {(psi || perf) && (
            <section className="au-section">
              <div className="au-label">{no()} — Szybkość strony</div>
              <div className="au-speed">
                {psi && (
                  <div className="au-speed-score">
                    <Gauge value={psi.score} label="PageSpeed · mobile" />
                  </div>
                )}
                <div className="au-speed-metrics">
                  {psi?.lcp?.text && <div className={'au-sm' + rate(psi.lcp.ms, 2500, 4000)}><div className="au-sm-val">{psi.lcp.text}</div><div className="au-sm-label">LCP · największy element</div></div>}
                  {psi?.fcp?.text && <div className={'au-sm' + rate(psi.fcp.ms, 1800, 3000)}><div className="au-sm-val">{psi.fcp.text}</div><div className="au-sm-label">FCP · pierwsza treść</div></div>}
                  {psi?.tbt?.text && <div className={'au-sm' + rate(psi.tbt.ms, 200, 600)}><div className="au-sm-val">{psi.tbt.text}</div><div className="au-sm-label">TBT · blokada wątku</div></div>}
                  {psi?.cls?.text && <div className={'au-sm' + rate(psi.cls.val, 0.1, 0.25)}><div className="au-sm-val">{psi.cls.text}</div><div className="au-sm-label">CLS · stabilność układu</div></div>}
                  {perf && <div className={'au-sm' + rate(perf.ttfbMs, 500, 1200)}><div className="au-sm-val">{perf.ttfbMs} ms</div><div className="au-sm-label">TTFB · odpowiedź serwera</div></div>}
                  {perf && <div className="au-sm"><div className="au-sm-val">{perf.htmlKb} KB</div><div className="au-sm-label">Waga HTML · skryptów: {perf.scripts}</div></div>}
                </div>
              </div>
              {speedTips.length > 0 && (
                <div className="au-tips">
                  {speedTips.map((t, i) => (
                    <div className="au-tip" key={i}><span className="au-tip-ic"><Ic name="wrench" size={16} /></span><span>{t}</span></div>
                  ))}
                </div>
              )}
              <div className="au-note">Pomiar: Google PageSpeed Insights (mobile){perf ? ' + pomiary własne serwera' : ''}.</div>
            </section>
          )}

          {/* KONKURENCJA */}
          {competitors.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Krajobraz konkurencji</div>
              <div className="au-comp">
                {competitors.map((k, i) => (
                  <div className="au-comp-card" key={i}>
                    <div className="au-comp-name"><Ic name="users" size={18} /> {k.name}</div>
                    <div className="au-comp-block">
                      <div className="au-comp-tag">Czym dziś wygrywa</div>
                      <p>{k.strengths}</p>
                    </div>
                    <div className="au-comp-block gap">
                      <div className="au-comp-tag">Wasza szansa</div>
                      <p>{k.gap}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FRAZY */}
          {keywords.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Czym szukają Was klienci</div>
              <div className="au-table-wrap">
                <table className="au-table">
                  <thead>
                    <tr><th>Fraza</th><th>Intencja</th><th>Potencjał</th></tr>
                  </thead>
                  <tbody>
                    {keywords.map((k, i) => (
                      <tr key={i}>
                        <td>{k.phrase}</td>
                        <td className="au-td-mono">{k.intent}</td>
                        <td className="au-td-pot">
                          <div className="au-kw-bar"><i style={{ width: (POT_W[String(k.potential || '').toLowerCase()] || 30) + '%' }} /></div>
                          <span className={'au-pot p-' + (k.potential || '')}>{k.potential}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="au-note">Szacunek na podstawie analizy AI — pełne wolumeny dostarczamy po podpięciu narzędzi w etapie 1.</div>
            </section>
          )}

          {/* GDZIE UCIEKAJĄ KLIENCI */}
          {lostQueries.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Zapytania, na których dziś tracicie klientów</div>
              <div className="au-lost">
                <div className="au-lost-head">
                  <div>Zapytanie</div><div>Dlaczego klient trafia gdzie indziej</div><div>Co wdrożyć</div>
                </div>
                {lostQueries.map((q, i) => (
                  <div className="au-lost-row" key={i}>
                    <div className="au-lost-q"><span className="au-lost-ic"><Ic name="funnel" size={15} /></span>„{q.query}"</div>
                    <div className="au-lost-why">{q.why}</div>
                    <div className="au-lost-fix">→ {q.fix}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PROMPTY AI */}
          {aiPrompts.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Jak klienci pytają AI</div>
              <p className="au-p">Coraz więcej decyzji zakupowych zaczyna się nie w Google, a w ChatGPT, Gemini czy Perplexity. Tak wyglądają realne pytania w Waszej branży:</p>
              <div className="au-prompts">
                {aiPrompts.map((g, i) => (
                  <div className="au-prompt-group" key={i}>
                    <div className="au-prompt-cat"><Ic name="message" size={16} /> {g.category}</div>
                    {g.prompts.map((p, k) => (
                      <div className="au-prompt" key={k}>
                        <span className="au-prompt-bot"><Ic name="robot" size={15} /></span>
                        <span>„{p}"</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DLACZEGO TERAZ */}
          {whyNow.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Dlaczego warto teraz</div>
              <div className="au-grid3">
                {whyNow.map((d, i) => (
                  <div className="au-card" key={i}>
                    <div className="au-card-ic"><Ic name={WHY_ICONS[i % WHY_ICONS.length]} /></div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* PLAN — таймлайн */}
          {plan.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Plan działania</div>
              <div className="au-plan">
                {plan.map((s, i) => (
                  <div className="au-step" key={i}>
                    <div className="au-step-rail">
                      <div className="au-step-node">{String(i + 1).padStart(2, '0')}</div>
                      {i < plan.length - 1 && <div className="au-step-line" />}
                    </div>
                    <div className="au-step-body">
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                      {s.effect && <div className="au-step-effect"><Ic name="chart" size={14} /> {s.effect}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* REKOMENDACJE */}
          {recs.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Co zmienić w pierwszej kolejności</div>
              <div className="au-recs">
                {recs.map((r, i) => (
                  <div className="au-rec" key={i}>
                    <div className="au-rec-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="au-rec-body">
                      <div className="au-rec-head">
                        <h3>{r.title}</h3>
                        <span className={'au-pot p-' + (r.priority || '')}><Ic name="flag" size={11} /> {r.priority}</span>
                      </div>
                      <p>{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* USŁUGI AI DLA KLIENTA */}
          {services.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Co możemy zbudować z AI dla {audit.client_name}</div>
              <p className="au-p">Poza widocznością w Google i AI jesteśmy agencją AI-native — projektujemy i wdrażamy systemy, które pracują w Waszym biznesie na co dzień. Dopasowane do Waszej branży:</p>
              <div className="au-services">
                {services.map((s, i) => (
                  <div className="au-service" key={i}>
                    <div className="au-service-ic"><Ic name={serviceIcon(s.name)} size={26} /></div>
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
                <div className="au-scope-head"><Ic name="chip" size={16} /> Fundament techniczny</div>
                {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
              </div>
              <div className="au-scope-col">
                <div className="au-scope-head"><Ic name="robot" size={16} /> Widoczność w AI (GEO)</div>
                {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
              </div>
            </div>
            <div className="au-packages">
              {(packages.length ? packages : [{ name: 'Podstawowy' }, { name: 'Standard' }, { name: 'Premium' }]).map((p, i) => (
                <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={i}>
                  {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                  <div className="au-pack-name">{p.name}</div>
                  <div className="au-pack-price">{(p.price || '').trim() || 'wycena indywidualna'}</div>
                  <div className="au-pack-bars" aria-hidden="true">
                    {[0, 1, 2].map(b => <i key={b} className={b <= i ? 'on' : ''} />)}
                  </div>
                </div>
              ))}
            </div>
            {prices.note && <div className="au-note">{prices.note}</div>}
            {!hasPrices && <div className="au-note">Szczegółową wycenę przedstawiamy po rozmowie — zakres dopasowujemy do celów.</div>}
          </section>

          {/* FAQ */}
          {faq.length > 0 && (
            <section className="au-section">
              <div className="au-label">{no()} — Najczęstsze pytania</div>
              <div className="au-faq">
                {faq.map((f, i) => (
                  <details className="au-faq-item" key={i}>
                    <summary><span className="au-faq-q"><Ic name="message" size={16} /> {f.q}</span><span className="au-faq-plus">＋</span></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* KONTAKT */}
          <section className="au-section au-contact">
            <GrowthDeco />
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
