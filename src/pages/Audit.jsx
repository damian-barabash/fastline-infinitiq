import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sbPublic } from '../lib/supabase.js';
import { Ic, Gauge, Radar, Bar, Segments, NetBg, Corners, Spark, GrowthDeco, Orbit, serviceIcon, productIcon, senseIcon, metricIcon } from '../components/auditIcons.jsx';
import { LogoFull, LogoMark, LogoMarkStroke } from '../components/logoSvg.jsx';
import auditCss from '../styles/audit.css?inline';

// Публичная страница аудита для клиента (v2, 2026-08-31): крупная контрастная типографика,
// большие диаграммы (gauge/radar/bars/segments), SVG-графика и анимации в каждой секции,
// инлайн-SVG лого FIQ как декор. Данные: public.audits (RLS: аноним видит только ready).
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

const TIER_LABEL = { 1: 'Start', 2: 'Wzrost', 3: 'Skala' };
const DIAG_ICONS = ['search', 'eye', 'layers'];
const WHY_ICONS = ['bolt', 'rocket', 'clock'];
const POT_W = { wysoki: 100, 'średni': 62, sredni: 62, niski: 30 };

const nzObj = (a) => Array.isArray(a) ? a.filter(x => x && Object.values(x).some(v => String(v || '').trim())) : [];
const nzStr = (a) => Array.isArray(a) ? a.filter(s => String(s || '').trim()) : [];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Заголовок секции: номер + большой H2 + лид
function SecHead({ no, label, title, lead, icon }) {
  return (
    <div className="au-sh">
      <div className="au-label">{no} — {label}</div>
      <div className="au-sh-row">
        {icon && <div className="au-sh-ic"><Ic name={icon} size={30} sw={1.4} /></div>}
        <div>
          <h2 className="au-h2">{title}</h2>
          {lead && <p className="au-lead">{lead}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Audit() {
  const { slug } = useParams();
  const [audit, setAudit] = useState(undefined);

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

  // reveal по скроллу + count-up чисел (data-to) при появлении секции
  useEffect(() => {
    if (!audit) return;
    const timers = [];
    const countUp = (root) => {
      root.querySelectorAll('.au-count[data-to]').forEach(el => {
        if (el.dataset.done) return;
        el.dataset.done = '1';
        const to = +el.dataset.to || 0;
        const t0 = performance.now();
        const dur = 1100;
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(to * e));
          if (p < 1) timers.push(requestAnimationFrame(step));
        };
        timers.push(requestAnimationFrame(step));
      });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('au-vis'); countUp(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.au-section, .au-hero').forEach(el => io.observe(el));
    return () => { io.disconnect(); timers.forEach(cancelAnimationFrame); };
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
  const products = nzObj(c.products).filter(p => p.id && p.name).map(p => ({ ...p, scope: nzStr(p.scope), kpi: nzStr(p.kpi) }));
  const autoPackages = (Array.isArray(c.packages) ? c.packages : []).filter(p => p && Array.isArray(p.product_ids) && p.product_ids.length);
  const faq = nzObj(c.faq).filter(f => (f.q || '').trim() && (f.a || '').trim());
  const scores = c.scores && typeof c.scores === 'object' ? c.scores : null;
  const competitors = nzObj(c.competitors);
  const matrix = c.competitor_matrix && Array.isArray(c.competitor_matrix.rivals) && c.competitor_matrix.rivals.length
    ? c.competitor_matrix : null;
  const lostQueries = nzObj(c.lost_queries);
  const speedTips = nzStr(c.speed_tips);
  const recs = nzObj(c.recommendations);
  const speed = c.speed && typeof c.speed === 'object' ? c.speed : null;
  const psi = speed?.psi || null;
  const perf = speed?.local || null;
  const rate = (v, good, poor) => v == null ? '' : v <= good ? ' m-good' : v <= poor ? ' m-mid' : ' m-poor';
  const rateTone = (v, good, poor) => v == null ? '' : v <= good ? 'good' : v <= poor ? 'mid' : 'poor';
  const goodCount = plus.length, badCount = minus.length;
  const metricsBad = metrics.filter(m => /brak|nie|false|0/i.test(String(m.value || ''))).length;

  // тема в цветах сайта клиента
  const hexRgb = (h) => {
    const m = /^#([0-9a-f]{6})$/i.exec(String(h || '').trim());
    return m ? { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) } : null;
  };
  const theme = audit?.site_meta?.theme || null;
  let themeStyle;
  if (theme) {
    const bg = hexRgb(theme.bg), acc = hexRgb(theme.accent);
    if (bg && acc) {
      const lumOf = (x) => (0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b) / 255;
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
  const yn = (v) => v
    ? <span className="au-mx-yes"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg></span>
    : <span className="au-mx-no"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg></span>;
  const SIGNALS = ['hasDesc', 'hasSchema', 'hasOg', 'hasCanonical', 'hasHreflang', 'hasChat', 'hasBlog', 'hasBooking'];
  const sigCount = (x) => SIGNALS.reduce((a, k) => a + (x?.[k] ? 1 : 0), 0);

  return (
    <div className="au-page" style={themeStyle}>
      <style dangerouslySetInnerHTML={{ __html: auditCss }} />

      <header className="au-top">
        <div className="au-fiq-logo"><LogoFull /></div>
        <div className="au-top-label">Audyt SEO · GEO</div>
        {audit && <div className="au-top-date">{fmtDate(audit.generated_at || audit.created_at)}</div>}
      </header>

      {audit === undefined && <div className="au-gate">Ładowanie audytu…</div>}
      {audit === null && (
        <div className="au-gate">
          <div className="au-gate-title">Nie znaleziono audytu</div>
          <div>Sprawdź link lub skontaktuj się: <a href="mailto:infinitiq@fastline.pl">infinitiq@fastline.pl</a></div>
        </div>
      )}

      {audit && (
        <main className="au-main">
          {/* ===== HERO ===== */}
          <section className="au-hero">
            <NetBg />
            <div className="au-hero-mark"><LogoMarkStroke /><LogoMark /></div>
            <div className="au-hero-beam" aria-hidden="true" />
            <div className="au-hero-inner">
              {audit.logo_url && (
                <div className={'au-client-logo' + (audit.site_meta?.logo_light ? ' dark' : '')}>
                  <img src={audit.logo_url} alt={audit.client_name} onError={e => { e.target.parentNode.style.display = 'none'; }} />
                </div>
              )}
              <div className="au-eyebrow"><span className="au-dot" /> Audyt SEO · GEO — {audit.client_name} · oferta ważna 14 dni</div>
              <h1 className="au-h1">{c.hero?.headline || `Widoczność ${audit.client_name} w Google i w AI`}</h1>
              {c.hero?.sub && <p className="au-sub">{c.hero.sub}</p>}
              {scores && (
                <div className="au-scoreboard">
                  <div className="au-gauges">
                    <Gauge value={scores.google} label="Widoczność w Google" />
                    <Gauge value={scores.ai} label="Widoczność w AI" />
                    <Gauge value={scores.technika} label="Technika strony" />
                    <Gauge value={scores.tresc} label="Jakość treści" />
                  </div>
                  <div className="au-radar-wrap">
                    <Radar scores={scores} />
                    <div className="au-radar-cap">Profil widoczności · 0–100</div>
                  </div>
                </div>
              )}
              <div className="au-hero-note"><LogoMark className="au-inline-mark" /> Przygotowane przez Fastline InfinitiQ · AI-Native Agency</div>
            </div>
          </section>

          {/* ===== DIAGNOZA ===== */}
          {diagnosis.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Diagnoza" icon="search" title="Jak rozumiemy Waszą sytuację"
                lead={`${c.branza ? c.branza + '. ' : ''}${c.klient_docelowy ? 'Klient docelowy: ' + c.klient_docelowy : ''}`} />
              <div className="au-grid3">
                {diagnosis.map((d, i) => (
                  <div className="au-card" key={i}>
                    <Corners />
                    <div className="au-card-ic"><Ic name={DIAG_ICONS[i % DIAG_ICONS.length]} size={30} sw={1.4} /></div>
                    <div className="au-card-no">0{i + 1}</div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PUNKT WYJŚCIA ===== */}
          {metrics.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Punkt wyjścia" icon="chip" title="Co widzą dziś Google i AI"
                lead={`${metrics.length - metricsBad} z ${metrics.length} sygnałów działa. ${metricsBad ? `${metricsBad} do naprawy — to konkretne, mierzalne braki, nie opinia.` : 'Fundament jest — walczymy o skalę.'}`} />
              <div className="au-metrics">
                {metrics.map((m, i) => {
                  const bad = /brak|nie|false|0/i.test(String(m.value || ''));
                  return (
                    <div className={'au-metric' + (bad ? ' bad' : ' good')} key={i}>
                      <div className="au-metric-ic"><Ic name={metricIcon(m.label)} size={26} sw={1.5} /></div>
                      <div className="au-metric-val">{m.value}</div>
                      <div className="au-metric-label">{m.label}</div>
                      <div className="au-metric-state">{bad ? <><Ic name="warn" size={14} /> do naprawy</> : <><Ic name="check" size={14} /> działa</>}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===== ANALIZA +/- ===== */}
          {(plus.length > 0 || minus.length > 0) && (
            <section className="au-section">
              <SecHead no={no()} label="Analiza obecnego stanu" icon="eye" title="Co działa, a co kosztuje widoczność" />
              <div className="au-pm-bar">
                <div className="au-pm-bar-track">
                  <i className="ok" style={{ '--w': `${Math.round(goodCount / Math.max(1, goodCount + badCount) * 100)}%` }} />
                  <i className="warn" style={{ '--w': `${Math.round(badCount / Math.max(1, goodCount + badCount) * 100)}%` }} />
                </div>
                <div className="au-pm-bar-cap"><span><b>{goodCount}</b> atuty</span><span><b>{badCount}</b> do poprawy</span></div>
              </div>
              <div className="au-pm">
                <div className="au-pm-col">
                  <div className="au-pm-head plus"><Ic name="shield" size={20} /> Na plus</div>
                  {plus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
                <div className="au-pm-col">
                  <div className="au-pm-head minus"><Ic name="bolt" size={20} /> Do poprawy</div>
                  {minus.map((t, i) => (
                    <div className="au-pm-item" key={i}>
                      <svg className="au-pm-mark warn" viewBox="0 0 24 24"><path d="M12 3l9.5 17h-19z" /><path d="M12 9.5v4.5" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ===== SZYBKOŚĆ ===== */}
          {(psi || perf) && (
            <section className="au-section">
              <SecHead no={no()} label="Szybkość strony" icon="speed" title="Jak szybko ładuje się strona na telefonie"
                lead="Google mierzy Core Web Vitals na urządzeniach mobilnych — wolna strona traci pozycje i klientów, zanim zobaczą ofertę." />
              <div className="au-speed">
                {psi && <div className="au-speed-score"><Gauge value={psi.score} label="PageSpeed · mobile" size={190} /></div>}
                <div className="au-speed-metrics">
                  {psi?.lcp?.ms != null && <Bar label="LCP · największy element" value={Math.min(psi.lcp.ms, 6000)} max={6000} text={psi.lcp.text} tone={rateTone(psi.lcp.ms, 2500, 4000)} />}
                  {psi?.fcp?.ms != null && <Bar label="FCP · pierwsza treść" value={Math.min(psi.fcp.ms, 5000)} max={5000} text={psi.fcp.text} tone={rateTone(psi.fcp.ms, 1800, 3000)} />}
                  {psi?.tbt?.ms != null && <Bar label="TBT · blokada wątku" value={Math.min(psi.tbt.ms, 1200)} max={1200} text={psi.tbt.text} tone={rateTone(psi.tbt.ms, 200, 600)} />}
                  {psi?.cls?.val != null && <Bar label="CLS · stabilność układu" value={Math.min(psi.cls.val, 0.5)} max={0.5} text={psi.cls.text} tone={rateTone(psi.cls.val, 0.1, 0.25)} />}
                  {perf && <Bar label="TTFB · odpowiedź serwera" value={Math.min(perf.ttfbMs, 2500)} max={2500} text={`${perf.ttfbMs} ms`} tone={rateTone(perf.ttfbMs, 500, 1200)} />}
                  {perf && <Bar label={`Waga HTML · skryptów: ${perf.scripts}`} value={Math.min(perf.htmlKb, 1500)} max={1500} text={`${perf.htmlKb} KB`} tone={rateTone(perf.htmlKb, 300, 800)} />}
                </div>
              </div>
              {speedTips.length > 0 && (
                <div className="au-tips">
                  {speedTips.map((t, i) => (
                    <div className="au-tip" key={i}><span className="au-tip-ic"><Ic name="wrench" size={20} /></span><span>{t}</span></div>
                  ))}
                </div>
              )}
              <div className="au-note">Pomiar: Google PageSpeed Insights (mobile){perf ? ' + pomiary własne serwera' : ''}. Zielony = w normie Google, żółty = do poprawy, czerwony = krytycznie.</div>
            </section>
          )}

          {/* ===== KONKURENCJA ===== */}
          {(competitors.length > 0 || matrix) && (
            <section className="au-section">
              <SecHead no={no()} label="Analiza konkurencji" icon="users" title="Kto dziś zbiera Waszych klientów"
                lead={matrix ? `Zmierzyliśmy strony konkurentów tymi samymi narzędziami — ${matrix.search?.queries?.length ? 'znalezionych po zapytaniach, którymi realnie szukają klienci' : 'wskazanych do porównania'}. Poniżej twarde dane, nie opinie.` : 'Bez zmierzonych stron — opisujemy typy konkurentów, z którymi konkurujecie o klienta w Google i AI.'} />
              {matrix && (() => {
                const cols = [matrix.client, ...matrix.rivals];
                const best = (vals, lowIsBetter) => {
                  const nums = vals.filter(v => typeof v === 'number');
                  if (!nums.length) return null;
                  return lowIsBetter ? Math.min(...nums) : Math.max(...nums);
                };
                const bTtfb = best(cols.map(x => x.ttfbMs), true);
                const bKb = best(cols.map(x => x.htmlKb), true);
                const maxTtfb = Math.max(...cols.map(x => x.ttfbMs || 0), 1);
                const num = (v, b, unit) => <span className={'au-mx-num' + (v === b ? ' best' : '')}>{v}{unit}</span>;
                const ROWS = [
                  ['Meta description', x => yn(x.hasDesc)],
                  ['Schema.org (dane dla AI)', x => yn(x.hasSchema)],
                  ['Open Graph', x => yn(x.hasOg)],
                  ['Canonical', x => yn(x.hasCanonical)],
                  ['Wersje językowe (hreflang)', x => yn(x.hasHreflang)],
                  ['Chat / agent na stronie', x => yn(x.hasChat)],
                  ['Blog / aktualności', x => yn(x.hasBlog)],
                  ['Odpowiedź serwera (TTFB)', x => num(x.ttfbMs, bTtfb, ' ms')],
                  ['Waga HTML', x => num(x.htmlKb, bKb, ' KB')],
                ];
                return (
                  <>
                    <div className="au-mx-cards">
                      {cols.map((x, i) => (
                        <div className={'au-mx-card' + (i === 0 ? ' me' : '')} key={i}>
                          <div className="au-mx-card-name">{i === 0 ? audit.client_name : x.domain}{i === 0 && <span className="au-mx-you">Wy</span>}</div>
                          <Segments value={sigCount(x)} total={SIGNALS.length} label="sygnałów widoczności" />
                          <Bar label="TTFB" value={x.ttfbMs || 0} max={maxTtfb} text={`${x.ttfbMs ?? '—'} ms`} tone={rateTone(x.ttfbMs, 500, 1200)} />
                        </div>
                      ))}
                    </div>
                    <div className="au-table-wrap au-mx-wrap">
                      <table className="au-table au-mx">
                        <thead>
                          <tr>
                            <th>Czynnik (pomiar rzeczywisty)</th>
                            {cols.map((x, i) => <th key={i} className={i === 0 ? 'au-mx-client' : ''}>{i === 0 ? audit.client_name : x.domain}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {ROWS.map(([label, fn], ri) => (
                            <tr key={ri}>
                              <td className="au-mx-factor">{label}</td>
                              {cols.map((x, i) => <td key={i} className={i === 0 ? 'au-mx-client' : ''}>{fn(x)}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="au-note">Zmierzone przez nas bezpośrednio na stronach ({new Date(audit.generated_at || audit.created_at).toLocaleDateString('pl-PL')}).</div>
                  </>
                );
              })()}
              {Array.isArray(c.competitor_matrix?.unmeasured) && c.competitor_matrix.unmeasured.length > 0 && (
                <div className="au-note">
                  {c.competitor_matrix.unmeasured.map(u =>
                    u.domain + (u.alive ? ' — strona aktywna, ale blokuje automatyczny pomiar (ochrona przed botami); analiza jakościowa poniżej' : ' — strona nie odpowiadała w czasie pomiaru')
                  ).join(' · ')}
                </div>
              )}
              {competitors.length > 0 && (
                <div className="au-comp">
                  {competitors.map((k, i) => (
                    <div className="au-comp-card" key={i}>
                      <Corners />
                      <div className="au-comp-name"><span className="au-comp-ic"><Ic name="users" size={22} /></span> {k.name}</div>
                      {k.profile && <div className="au-comp-profile">{k.profile}</div>}
                      <Spark seed={i + 3} up={i % 2 === 0} />
                      <div className="au-comp-block">
                        <div className="au-comp-tag"><Ic name="trend" size={13} /> Czym dziś wygrywa</div>
                        <p>{k.strengths}</p>
                      </div>
                      <div className="au-comp-block gap">
                        <div className="au-comp-tag"><Ic name="target" size={13} /> Wasza szansa</div>
                        <p>{k.gap}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ===== FRAZY ===== */}
          {keywords.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Frazy" icon="search" title="Czym szukają Was klienci"
                lead="Osiem zapytań, które realni klienci wpisują w Google, szukając takiej oferty. Potencjał = jak dużo klientów za tym stoi." />
              <div className="au-kw">
                {keywords.map((k, i) => (
                  <div className="au-kw-row" key={i}>
                    <div className="au-kw-phrase"><span className="au-kw-no">{String(i + 1).padStart(2, '0')}</span>{k.phrase}</div>
                    <div className="au-kw-intent"><Ic name={/lokal/i.test(k.intent) ? 'compass' : /zakup/i.test(k.intent) ? 'cart' : /porówn/i.test(k.intent) ? 'layers' : 'book'} size={15} /> {k.intent}</div>
                    <div className="au-kw-pot">
                      <div className="au-kw-bar"><i style={{ '--w': (POT_W[String(k.potential || '').toLowerCase()] || 30) + '%' }} /></div>
                      <span className={'au-pot p-' + (k.potential || '')}>{k.potential}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="au-note">Szacunek na podstawie analizy AI — pełne wolumeny dostarczamy po podpięciu narzędzi w etapie 1.</div>
            </section>
          )}

          {/* ===== GDZIE UCIEKAJĄ KLIENCI ===== */}
          {lostQueries.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Utracone zapytania" icon="funnel" title="Zapytania, na których dziś tracicie klientów"
                lead="Klient pyta — a odpowiedź znajduje gdzie indziej. Każdy wiersz to konkretny wyciek z lejka i konkretna naprawa." />
              <div className="au-lost">
                <div className="au-lost-head">
                  <div>Zapytanie</div><div>Dlaczego klient trafia gdzie indziej</div><div>Co wdrożyć</div>
                </div>
                {lostQueries.map((q, i) => (
                  <div className="au-lost-row" key={i}>
                    <div className="au-lost-q"><span className="au-lost-ic"><Ic name="funnel" size={18} /></span>„{q.query}"</div>
                    <div className="au-lost-why">{q.why}</div>
                    <div className="au-lost-fix"><Ic name="arrow" size={16} /> <span>{q.fix}</span></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PROMPTY AI ===== */}
          {aiPrompts.length > 0 && (
            <section className="au-section">
              <div className="au-prompts-head">
                <SecHead no={no()} label="Jak klienci pytają AI" icon="robot" title="Decyzje zakupowe zaczynają się w ChatGPT"
                  lead="Coraz więcej decyzji zaczyna się nie w Google, a w ChatGPT, Gemini czy Perplexity. Jeśli model o Was nie wie — nie istniejecie w tej rozmowie. Tak wyglądają realne pytania w Waszej branży:" />
                <Orbit />
              </div>
              <div className="au-prompts">
                {aiPrompts.map((g, i) => (
                  <div className="au-prompt-group" key={i}>
                    <div className="au-prompt-cat"><Ic name="message" size={18} /> {g.category}</div>
                    {g.prompts.map((p, k) => (
                      <div className="au-prompt" key={k}>
                        <span className="au-prompt-bot"><Ic name="robot" size={18} /></span>
                        <span>„{p}"</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== DLACZEGO TERAZ ===== */}
          {whyNow.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Dlaczego teraz" icon="clock" title="Dlaczego warto działać teraz" />
              <div className="au-grid3">
                {whyNow.map((d, i) => (
                  <div className="au-card" key={i}>
                    <Corners />
                    <div className="au-card-ic"><Ic name={WHY_ICONS[i % WHY_ICONS.length]} size={30} sw={1.4} /></div>
                    <div className="au-card-no">0{i + 1}</div>
                    <h3>{d.title}</h3>
                    <p>{d.text}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PLAN ===== */}
          {plan.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Plan działania" icon="compass" title="Trzy etapy — od fundamentu do skali" />
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
                      {s.effect && <div className="au-step-effect"><Ic name="chart" size={18} /> {s.effect}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== REKOMENDACJE ===== */}
          {recs.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Rekomendacje" icon="flag" title="Co zmienić w pierwszej kolejności"
                lead="Uporządkowane według wpływu na widoczność i sprzedaż. Wysoki priorytet = robimy w pierwszym miesiącu." />
              <div className="au-recs">
                {recs.map((r, i) => (
                  <div className={'au-rec pr-' + String(r.priority || '').toLowerCase()} key={i}>
                    <div className="au-rec-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="au-rec-body">
                      <div className="au-rec-head">
                        <h3>{r.title}</h3>
                        <span className={'au-pot p-' + (r.priority || '')}><Ic name="flag" size={12} /> {r.priority}</span>
                      </div>
                      <p>{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ===== PRODUKTY Z KATALOGU FIQ ===== */}
          {products.length > 0 && (
            <section className="au-section au-products-sec">
              <div className="au-watermark"><LogoMark /></div>
              <SecHead no={no()} label="Produkty AI" icon="brain" title={`Produkty AI dopasowane do ${audit.client_name}`}
                lead={`Fastline InfinitiQ to 18 gotowych systemów AI, które sprzedają, obsługują i zarządzają. Z katalogu wybraliśmy ${products.length} produktów, które odpowiadają na to, co widzimy na Waszej stronie i w Waszej branży — każdy opisany pod Wasz biznes, z ceną katalogową.`} />
              <div className="au-products">
                {products.map((p) => (
                  <article className={'au-prod tier-' + (p.tier || 2)} key={p.id}>
                    <div className="au-prod-head">
                      <div className="au-prod-ic"><Ic name={productIcon(p.id, p.name)} size={34} sw={1.4} /></div>
                      <div className="au-prod-meta">
                        <div className="au-prod-tags">
                          <span className="au-prod-no">#{String(p.id).padStart(2, '0')}</span>
                          <span className="au-prod-group">{p.group}</span>
                          {p.sense && <span className="au-prod-sense"><Ic name={senseIcon(p.sense)} size={13} /> {p.sense}</span>}
                          <span className={'au-prod-tier t' + (p.tier || 2)}>{TIER_LABEL[p.tier] || 'Wzrost'}</span>
                        </div>
                        <h3>{p.name}</h3>
                        {p.tagline && <div className="au-prod-tagline">{p.tagline}</div>}
                      </div>
                      <div className="au-prod-price">
                        <div className="au-prod-price-row"><span>Wdrożenie</span><b>{p.impl_label}</b></div>
                        <div className="au-prod-price-row main"><span>Abonament</span><b>{p.sub_label}</b></div>
                      </div>
                    </div>
                    <div className="au-prod-body">
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="target" size={14} /> Dlaczego u Was</div>
                        <p>{p.why}</p>
                        {p.example && <div className="au-prod-example"><span className="au-prod-example-ic"><Ic name="message" size={18} /></span><span>{p.example}</span></div>}
                      </div>
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="wrench" size={14} /> Co wdrażamy</div>
                        <ul className="au-prod-scope">
                          {(p.scope.length ? p.scope : nzStr(p.does)).map((s, k) => <li key={k}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="au-prod-col">
                        <div className="au-prod-tag"><Ic name="trend" size={14} /> Efekt</div>
                        <p>{p.effect}</p>
                        {p.kpi.length > 0 && (
                          <div className="au-prod-kpi">
                            <div className="au-prod-kpi-label"><Ic name="chart" size={14} /> Mierzymy</div>
                            {p.kpi.map((k, i) => <span key={i}>{k}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="au-note">Ceny netto z katalogu produktów Fastline InfinitiQ (segment MŚP): wdrożenie jednorazowe + abonament miesięczny, „od” — finalna wycena po rozmowie. InfinitiQ Secure (prywatna warstwa AI, RODO i EU AI Act) w cenie każdego produktu.</div>
            </section>
          )}

          {/* starsze audyty bez katalogu */}
          {products.length === 0 && services.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Usługi AI" icon="brain" title={`Co możemy zbudować z AI dla ${audit.client_name}`} />
              <div className="au-services">
                {services.map((s, i) => (
                  <div className="au-service" key={i}>
                    <div className="au-service-ic"><Ic name={serviceIcon(s.name)} size={30} /></div>
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

          {/* ===== PAKIETY ===== */}
          {autoPackages.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Pakiety i inwestycja" icon="layers" title="Trzy drogi wejścia — jeden ekosystem"
                lead="Nie trzeba brać wszystkiego naraz. Zaczynacie od pakietu, który zamyka najpilniejszy problem, a kolejne produkty dokładacie, gdy zobaczycie wynik — wszystkie podpinają się do tej samej bazy wiedzy, jednego głosu marki i jednej warstwy InfinitiQ Secure." />
              <div className="au-packages au-packs">
                {autoPackages.map((pk, i) => {
                  const manual = (packages[i]?.price || '').trim();
                  const items = pk.product_ids.map(id => products.find(p => p.id === id)).filter(Boolean);
                  const maxSub = Math.max(...autoPackages.map(x => x.sub_from || 0), 1);
                  return (
                    <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={pk.key || i}>
                      <Corners />
                      {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                      <div className="au-pack-level">{[0, 1, 2].map(b => <i key={b} className={b <= i ? 'on' : ''} />)}</div>
                      <div className="au-pack-name">{pk.name}</div>
                      {pk.subtitle && <div className="au-pack-subtitle">{pk.subtitle}</div>}
                      {pk.goal && <p className="au-pack-goal">{pk.goal}</p>}
                      <ul className="au-pack-items">
                        {items.map(p => (
                          <li key={p.id}>
                            <span className="au-pack-item-ic"><Ic name={productIcon(p.id, p.name)} size={18} /></span>
                            <span className="au-pack-item-name">{p.name}</span>
                            <em>{p.sub_label}</em>
                          </li>
                        ))}
                      </ul>
                      <div className="au-pack-total">
                        <div className="au-pack-price">{manual || pk.sub_label}</div>
                        {!manual && (
                          <>
                            <div className="au-pack-costbar"><i style={{ '--w': Math.round((pk.sub_from || 0) / maxSub * 100) + '%' }} /></div>
                            <div className="au-pack-sub"><span>wdrożenie <b>{pk.impl_label}</b></span><span>{pk.year_label}</span></div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="au-scope au-scope-after">
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="chip" size={20} /> W każdym pakiecie: fundament techniczny</div>
                  {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="robot" size={20} /> W każdym pakiecie: widoczność w AI (GEO)</div>
                  {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
              </div>
              {prices.note && <div className="au-note">{prices.note}</div>}
              <div className="au-note">Sumy pakietów = ceny katalogowe „od” wybranych produktów (netto). Wdrożenie, integracje i utrzymanie są po naszej stronie — model: wdrożenie jednorazowe + abonament miesięczny. Szacunek pierwszego roku = wdrożenie + 12 abonamentów.</div>
            </section>
          )}

          {/* starsze audyty: pakiety ręczne */}
          {autoPackages.length === 0 && (
            <section className="au-section">
              <SecHead no={no()} label="Zakres i inwestycja" icon="layers" title="Zakres współpracy" />
              <div className="au-scope">
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="chip" size={20} /> Fundament techniczny</div>
                  {SCOPE.basic.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
                <div className="au-scope-col">
                  <div className="au-scope-head"><Ic name="robot" size={20} /> Widoczność w AI (GEO)</div>
                  {SCOPE.geo.map((t, i) => <div className="au-scope-item" key={i}>{t}</div>)}
                </div>
              </div>
              <div className="au-packages">
                {(packages.length ? packages : [{ name: 'Podstawowy' }, { name: 'Standard' }, { name: 'Premium' }]).map((p, i) => (
                  <div className={'au-pack' + (i === 1 ? ' feat' : '')} key={i}>
                    {i === 1 && <div className="au-pack-tag">Najczęściej wybierany</div>}
                    <div className="au-pack-name">{p.name}</div>
                    <div className="au-pack-price">{(p.price || '').trim() || 'wycena indywidualna'}</div>
                    <div className="au-pack-level">{[0, 1, 2].map(b => <i key={b} className={b <= i ? 'on' : ''} />)}</div>
                  </div>
                ))}
              </div>
              {prices.note && <div className="au-note">{prices.note}</div>}
              {!hasPrices && <div className="au-note">Szczegółową wycenę przedstawiamy po rozmowie — zakres dopasowujemy do celów.</div>}
            </section>
          )}

          {/* ===== FAQ ===== */}
          {faq.length > 0 && (
            <section className="au-section">
              <SecHead no={no()} label="FAQ" icon="message" title="Najczęstsze pytania" />
              <div className="au-faq">
                {faq.map((f, i) => (
                  <details className="au-faq-item" key={i}>
                    <summary><span className="au-faq-q"><Ic name="message" size={20} /> {f.q}</span><span className="au-faq-plus">＋</span></summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* ===== KONTAKT ===== */}
          <section className="au-section au-contact">
            <GrowthDeco />
            <div className="au-watermark right"><LogoMark /></div>
            <div className="au-label">{no()} — Co dalej</div>
            <h2 className="au-h2 big">Porozmawiajmy o wdrożeniu.</h2>
            <p className="au-lead">Odpowiemy na pytania, doprecyzujemy zakres i ustalimy start. Pierwsza rozmowa — bez zobowiązań.</p>
            <a className="au-cta" href="mailto:infinitiq@fastline.pl?subject=Audyt%20SEO%20%C2%B7%20GEO">Napisz do nas → infinitiq@fastline.pl</a>
          </section>

          <footer className="au-footer">
            <div className="au-footer-logo"><LogoFull /></div>
            <p>© 2026 Fastline InfinitiQ — <a href="https://greywolfgroup.pl/" target="_blank" rel="noopener">Greywolf Group</a></p>
            <p>Data driven. Mind created. <span className="au-acc">AI executed.</span></p>
          </footer>
        </main>
      )}
    </div>
  );
}
