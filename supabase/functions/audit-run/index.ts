// audit-run — generuje audyt SEO/GEO strony klienta przez Barabash AI.
// Wywoływane z edytora (wymagany zalogowany user). Zapisuje wynik do public.audits.
// Ograniczenia: max 2 równoległe wywołania AI (wspólny gateway z innymi produktami —
// 2 pary sekwencyjnie), model z env AUDIT_MODEL. PageSpeed mierzy się równolegle z AI.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_URL = Deno.env.get("BARABASH_AI_URL") ?? "https://barabash-ai.tailcd3444.ts.net/v1";
const AI_KEY = Deno.env.get("BARABASH_AI_KEY") ?? "";
const AI_MODEL = Deno.env.get("AUDIT_MODEL") ?? "qwen3.5:9b";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

// ---------- pobranie i parsowanie strony klienta ----------
function absUrl(src: string, base: string): string {
  try { return new URL(src, base).href; } catch { return ""; }
}
function extract(re: RegExp, html: string): string {
  const m = html.match(re);
  return m ? m[1].trim() : "";
}
function extractAll(re: RegExp, html: string, max = 40): string[] {
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) && out.length < max) out.push(m[1].trim());
  return out;
}
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ").replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

async function fetchSite(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  const t0 = Date.now();
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        "Accept-Language": "pl,en;q=0.8",
      },
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Strona klienta odpowiedziała ${res.status}`);
  const ttfbMs = Date.now() - t0; // przybliżenie: connect+TTFB
  const html = (await res.text()).slice(0, 600_000);
  const base = res.url || url;

  const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const desc = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
  const ogImage = extract(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i, html);

  // logo: <img> z "logo" w src/class/alt → apple-touch-icon → og:image → favicon
  let logo = "";
  const imgTags = extractAll(/(<img[^>]+>)/gi, html, 200);
  for (const tag of imgTags) {
    if (/logo/i.test(tag)) {
      const src = extract(/src=["']([^"']+)["']/i, tag);
      if (src && !/\.svg\?|pixel|tracking/i.test(src)) { logo = absUrl(src, base); if (logo) break; }
    }
  }
  if (!logo) logo = absUrl(extract(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i, html), base);
  if (!logo && ogImage) logo = absUrl(ogImage, base);
  if (!logo) logo = absUrl(extract(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i, html), base);

  const h1 = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html, 6).map(stripTags);
  const h2 = extractAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, html, 20).map(stripTags);
  const h3 = extractAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, html, 20).map(stripTags);
  const hasSchema = /application\/ld\+json/i.test(html);
  const hasOg = /property=["']og:/i.test(html);
  const hasCanonical = /rel=["']canonical["']/i.test(html);
  const hasHreflang = /hreflang=/i.test(html);
  const langs = extractAll(/hreflang=["']([a-zA-Z-]+)["']/gi, html, 10);
  const text = stripTags(html).slice(0, 4000);

  // proste pomiary szybkości z samego HTML (fallback, gdy PageSpeed niedostępny)
  const perf = {
    ttfbMs,
    htmlKb: Math.round(html.length / 1024),
    scripts: (html.match(/<script/gi) || []).length,
    imgs: (html.match(/<img/gi) || []).length,
    lazyImgs: (html.match(/loading=["']lazy["']/gi) || []).length,
    webp: /\.webp/i.test(html),
  };

  return {
    finalUrl: base, title, desc, logo, h1, h2, h3, text, perf, html,
    signals: { hasSchema, hasOg, hasCanonical, hasHreflang, langs, htmlKb: perf.htmlKb },
  };
}

// ---------- paleta klienta (tło + akcent z CSS strony) ----------
type RGB = { r: number; g: number; b: number };
function parseColor(s: string): RGB | null {
  s = String(s || "").trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{6})\b/);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) };
  m = s.match(/^#([0-9a-f]{3})\b/);
  if (m) return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) };
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}
const lum = (c: RGB) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
const sat = (c: RGB) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; };
const hex = (c: RGB) => "#" + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

async function fetchCss(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return "";
    return (await r.text()).slice(0, 300_000);
  } catch { return ""; } finally { clearTimeout(t); }
}

async function extractTheme(html: string, base: string) {
  let css = extractAll(/<style[^>]*>([\s\S]*?)<\/style>/gi, html, 10).join("\n");
  // font-CDN пропускаем (съедают слоты), дедуп, до 6 листов
  const rawHrefs = extractAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi, html, 12)
    .concat(extractAll(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi, html, 12));
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const h of rawHrefs) {
    if (h.includes("fonts.") || seen.has(h)) continue;
    seen.add(h);
    const u = absUrl(h, base);
    if (u) hrefs.push(u);
    if (hrefs.length >= 6) break;
  }
  const sheets = await Promise.all(hrefs.map(fetchCss));
  css += "\n" + sheets.join("\n");

  const themeColor = parseColor(extract(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i, html));
  const bodyBg = parseColor(extract(/(?:^|[}\s])(?:body|html)[^{]*\{[^}]*?background(?:-color)?\s*:\s*([^;}!]+)/i, css));

  // частотный подсчёт цветов из CSS: определения кастом-переменных пропускаем
  // (пресеты WP Gutenberg вида --wp--preset--color-* давали ложные акценты),
  // реальные декларации (color/background/border/fill) весят больше
  const counts = new Map<string, { c: RGB; n: number }>();
  const reC = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([\d\s,./]+\)/gi;
  let mm: RegExpExecArray | null;
  while ((mm = reC.exec(css))) {
    const before = css.slice(Math.max(0, mm.index - 220), mm.index);
    if (/--[\w-]+\s*:\s*[^;{]*$/.test(before)) continue;
    const c = parseColor(mm[0]);
    if (!c) continue;
    const w = /(?:^|[;{])\s*(?:color|background(?:-color)?|border[^:]*|fill|stroke)\s*:\s*[^;{]*$/i.test(before) ? 3 : 1;
    const k = hex(c);
    const e = counts.get(k);
    if (e) e.n += w; else counts.set(k, { c, n: w });
  }
  // цвета из инлайн-стилей и svg в самом HTML — часто именно брендовые (вес 2)
  for (const m of html.matchAll(/(?:style|fill|color)=["'][^"']*?(#[0-9a-f]{6}\b|#[0-9a-f]{3}\b)/gi)) {
    const c = parseColor(m[1]);
    if (!c) continue;
    const k = hex(c);
    const e = counts.get(k);
    if (e) e.n += 2; else counts.set(k, { c, n: 2 });
  }
  const all = [...counts.values()].sort((a, b) => b.n - a.n);

  // тло: явный body-bg → theme-color → самый частый экстремально светлый/тёмный
  let bg = bodyBg || themeColor || null;
  if (!bg) bg = all.find(e => lum(e.c) > 0.9)?.c ?? all.find(e => lum(e.c) < 0.1)?.c ?? null;
  if (!bg) return null;
  const bgL = lum(bg);

  // чёрный список библиотечных палитр (WP Gutenberg presets, WP core, Ant Design,
  // Bootstrap defaults) — попадают в CSS любого сайта и дают ложный «акцент»
  const JUNK = new Set([
    "#0693e3", "#8ed1fc", "#eb144c", "#ff6900", "#fcb900", "#7bdcb5", "#00d084",
    "#abb8c3", "#9b51e0", "#f78da7", "#cf2e2e", "#313131", "#6495ed", "#3858e9",
    "#1890ff", "#40a9ff", "#69c0ff", "#91d5ff", "#bae7ff", "#e6f7ff", "#096dd9",
    "#0050b3", "#0d6efd", "#007bff", "#0dcaf0", "#20c997", "#6c757d",
    "#34e2e4", "#4721fb", "#ab1dfe", "#faaca8", "#fdd79a",
  ]);
  const ok = (e: { c: RGB; n: number }, minSat: number, minDiff: number, minN: number) =>
    !JUNK.has(hex(e.c)) && e.n >= minN && sat(e.c) >= minSat &&
    Math.abs(lum(e.c) - bgL) >= minDiff && lum(e.c) > 0.03 && lum(e.c) < 0.97;

  // акцент: самый «весомый» насыщенный контрастный цвет; пороги ослабляем ступенчато
  let accent = all.find(e => ok(e, 0.35, 0.2, 5))?.c
    ?? all.find(e => ok(e, 0.3, 0.18, 3))?.c
    ?? all.find(e => ok(e, 0.25, 0.15, 2))?.c
    ?? null;
  // без надёжного акцента: на светлом фоне — графит, на тёмном — фирменный acid
  if (!accent) accent = bgL > 0.5 ? { r: 20, g: 20, b: 20 } : { r: 184, g: 255, b: 0 };
  // страховка контраста
  if (Math.abs(lum(accent) - bgL) < 0.18) {
    const k = bgL > 0.5 ? 0.55 : 1.6;
    accent = { r: accent.r * k, g: accent.g * k, b: accent.b * k };
  }
  const fg = bgL > 0.5 ? "#141414" : "#F5F5F0";
  return { bg: hex(bg), accent: hex(accent), fg };
}

// ---------- konkurenci: pobranie + walidacja ----------
// Parking/sprzedaż domeny (motorsport.pl i torowisko.pl przekierowują na sklep
// z domenami i wyglądają na "żywe" — stąd twarda walidacja treści i redirectów).
const PARKED_RE = /domena (jest |zosta[lł]a )?(na sprzeda|do kupienia|wystawiona|zarejestrowana w serwisie)|:: domena|domain (is )?for sale|kup t[eę] domen|aftermarket\.pl|sklep\.premium\.pl|sedo\.|parkingcrew|dan\.com|afternic|domenomania|bodis\.|skenzo|domainpark|strona w budowie|strona w przygotowaniu|konto.{0,20}zawieszone|account suspended|hosting wygas/i;
const CF_RE = /just a moment|cf-browser-verification|_cf_chl|challenge-platform|attention required|enable javascript and cookies/i;

function normDomain(s: string): string {
  return String(s || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
}
function sameSite(a: string, b: string): boolean {
  a = normDomain(a); b = normDomain(b);
  return !!a && !!b && (a === b || a.endsWith("." + b) || b.endsWith("." + a));
}
// znormalizowane telefony (ostatnie 9 cyfr) — wspólny numer = ta sama firma
function phonesOf(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:\+?48|tel[:.\s]|phone)[\s.-]{0,3}(\d[\d\s.\-()]{7,14}\d)/gi)) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 9 && digits.length <= 12) out.add(digits.slice(-9));
  }
  return out;
}

type Rival = {
  domain: string; measured: boolean; alive: boolean;
  ttfbMs?: number; htmlKb?: number; hasDesc?: boolean; hasSchema?: boolean; hasOg?: boolean;
  hasCanonical?: boolean; hasHreflang?: boolean; h1?: number;
  title?: string; desc?: string; h1s?: string[]; snippet?: string; html?: string;
};

// Pobiera stronę konkurenta i liczy te same sygnały co u klienta.
// manual=true (domeny wpisane ręcznie w panelu): nie odrzucamy — najwyżej "brak pomiaru".
// Auto: odpada parking, redirect na obcą domenę, pusta atrapa, martwa strona.
async function fetchRival(domain: string, manual = false): Promise<Rival | null> {
  const d = normDomain(domain);
  if (!d || !d.includes(".") || /\s/.test(d)) return null;
  let protectedAlive = false;
  // https → www → http (zdarzają się zepsute certyfikaty przy działającym http)
  for (const u of [`https://${d}/`, `https://www.${d}/`, `http://${d}/`, `http://www.${d}/`]) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    let res: Response;
    const t0 = Date.now();
    try {
      res = await fetch(u, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          "Accept-Language": "pl,en;q=0.8",
        },
      });
    } catch { clearTimeout(t); continue; }
    clearTimeout(t);
    const ttfbMs = Date.now() - t0;
    const html = ((await res.text().catch(() => "")) || "").slice(0, 600_000);
    if (!res.ok) {
      // WAF/Cloudflare challenge: strona istnieje, ale nie da się jej zmierzyć botem
      if ([403, 429, 503].includes(res.status) && (CF_RE.test(html) || html.length < 40_000)) protectedAlive = true;
      continue;
    }
    let finalHost = d;
    try { finalHost = new URL(res.url || u).hostname; } catch { /* noop */ }
    const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
    const text = stripTags(html);
    // redirect na inną domenę = najczęściej parking/sprzedaż → auto odpada
    if (!sameSite(finalHost, d) && !manual) { console.log("rival", d, "odpada: redirect →", finalHost); return null; }
    // parking sprawdzamy też po SUROWYM HTML (linki/skrypty operatora parkingu):
    // wersja strony serwowana do data-center bywa ad-landerem bez słów kluczowych w tekście
    if (PARKED_RE.test(title + " " + html.slice(0, 30000) + " " + text.slice(0, 1500))) {
      console.log("rival", d, "odpada: parking domen");
      return manual ? { domain: d, measured: false, alive: false } : null;
    }
    // realna strona firmowa ma treść; parking/atrapa — kilkaset znaków
    if (text.length < 700 && !manual) { console.log("rival", d, "odpada: cienka treść", text.length); return null; }
    const desc = extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
    const h1s = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html, 4).map(stripTags);
    return {
      domain: d, measured: true, alive: true,
      ttfbMs,
      htmlKb: Math.round(html.length / 1024),
      hasDesc: !!desc,
      hasSchema: /application\/ld\+json/i.test(html),
      hasOg: /property=["']og:/i.test(html),
      hasCanonical: /rel=["']canonical["']/i.test(html),
      hasHreflang: /hreflang=/i.test(html),
      h1: h1s.length,
      title, desc, h1s,
      snippet: text.slice(0, 600),
      html,
    };
  }
  if (protectedAlive) return { domain: d, measured: false, alive: true };
  return manual ? { domain: d, measured: false, alive: false } : null;
}

// Google PageSpeed Insights (mobile) — realny pomiar, biegnie równolegle z AI.
async function fetchPSI(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    // bez klucza anonimowa kwota Google często wyczerpana → ustaw secret PSI_API_KEY
    const key = Deno.env.get("PSI_API_KEY");
    const r = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance${key ? `&key=${key}` : ""}`,
      { signal: ctrl.signal },
    );
    if (!r.ok) return null;
    const d = await r.json();
    const lh = d?.lighthouseResult;
    if (!lh) return null;
    const a = lh.audits ?? {};
    const pick = (k: string) => ({
      text: a[k]?.displayValue ?? null,
      ms: typeof a[k]?.numericValue === "number" ? Math.round(a[k].numericValue) : null,
    });
    return {
      score: Math.round((lh.categories?.performance?.score ?? 0) * 100),
      fcp: pick("first-contentful-paint"),
      lcp: pick("largest-contentful-paint"),
      cls: { text: a["cumulative-layout-shift"]?.displayValue ?? null, val: a["cumulative-layout-shift"]?.numericValue ?? null },
      tbt: pick("total-blocking-time"),
      si: pick("speed-index"),
    };
  } catch { return null; } finally { clearTimeout(t); }
}

// ---------- Barabash AI ----------
async function askAI(system: string, user: string, maxTokens: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 70000);
  let res: Response;
  try {
    res = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${AI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        stream: false,
        temperature: 0.4,
        max_tokens: maxTokens,
        think: false,
      }),
    });
  } finally { clearTimeout(t); }
  if (!res.ok) throw new Error(`Barabash AI: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// Domyka otwarte nawiasy/cudzysłowy w przyciętym fragmencie JSON.
function closeBrackets(s: string): string {
  let inStr = false, esc = false;
  const st: string[] = [];
  for (const c of s) {
    if (esc) { esc = false; continue; }
    if (c === "\\") { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") st.push(c);
    else if (c === "}" || c === "]") st.pop();
  }
  let out = s;
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  while (st.length) out += st.pop() === "{" ? "}" : "]";
  return out;
}

// Naprawa zepsutego/uciętego JSON: tniemy od końca do kolejnych granic
// strukturalnych i próbujemy domknąć — pierwsza parsowalna wersja wygrywa.
function repairJson(s: string): Record<string, unknown> {
  let end = s.length;
  for (let iter = 0; iter < 400 && end > 1; iter++) {
    const cut = s.slice(0, end);
    try { return JSON.parse(closeBrackets(cut)); } catch { /* tnij dalej */ }
    const idx = Math.max(cut.lastIndexOf(","), cut.lastIndexOf("{"), cut.lastIndexOf("["), cut.lastIndexOf('"'));
    if (idx <= 0) break;
    end = idx;
  }
  throw new Error("Model nie zwrócił poprawnego JSON");
}

function parseJson(raw: string): Record<string, unknown> {
  let s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const a = s.indexOf("{");
  if (a === -1) throw new Error("Model nie zwrócił JSON");
  const b = s.lastIndexOf("}");
  s = b > a ? s.slice(a, b + 1) : s.slice(a);
  try { return JSON.parse(s); } catch { /* spróbuj naprawić */ }
  return repairJson(s);
}

// Wywołanie AI + parse z jedną powtórką przy niepoprawnym JSON.
async function askJson(system: string, user: string, maxTokens: number): Promise<Record<string, unknown>> {
  try {
    return parseJson(await askAI(system, user, maxTokens));
  } catch (_) {
    const reminder = user + `\n\nUWAGA: poprzednia odpowiedź miała niepoprawny JSON. Zwróć TYLKO poprawny JSON. W tekstach nie używaj znaku cudzysłowu prostego (") — pisz bez cytatów.`;
    return parseJson(await askAI(system, reminder, maxTokens));
  }
}

const SYS = "Jesteś senior konsultantem SEO/GEO (widoczność w Google i w odpowiedziach AI: ChatGPT, Gemini, Perplexity) w agencji Fastline InfinitiQ. Piszesz po polsku: rzeczowo, bez lania wody, bez przesady marketingowej — diagnoza, nie reklama. Odpowiadasz WYŁĄCZNIE poprawnym JSON, bez markdown, bez komentarzy.";

function siteBrief(meta: Awaited<ReturnType<typeof fetchSite>>, clientName: string, url: string): string {
  return [
    `Klient: ${clientName}`,
    `URL: ${url} (final: ${meta.finalUrl})`,
    `Title: ${meta.title || "(brak)"}`,
    `Meta description: ${meta.desc || "(brak)"}`,
    `H1: ${meta.h1.join(" | ") || "(brak)"}`,
    `H2: ${meta.h2.slice(0, 12).join(" | ") || "(brak)"}`,
    `H3: ${meta.h3.slice(0, 10).join(" | ") || "(brak)"}`,
    `Sygnały techniczne: schema.org=${meta.signals.hasSchema}, OpenGraph=${meta.signals.hasOg}, canonical=${meta.signals.hasCanonical}, hreflang=${meta.signals.hasHreflang} (${meta.signals.langs.join(",") || "-"}), rozmiar HTML=${meta.signals.htmlKb}KB`,
    `--- Treść strony (fragment) ---`,
    meta.text,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // auth: tylko zalogowany user edytora
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Wymagane logowanie" }, 401);

  const db = createClient(supaUrl, service);
  let id = "";
  try {
    const body = await req.json();
    id = String(body?.id ?? "");
  } catch { /* noop */ }
  if (!id) return json({ error: "Brak id audytu" }, 400);

  const { data: audit, error: loadErr } = await db.from("audits").select("*").eq("id", id).maybeSingle();
  if (loadErr || !audit) return json({ error: "Nie znaleziono audytu" }, 404);
  if (!AI_KEY) {
    await db.from("audits").update({ status: "error", error: "Brak klucza BARABASH_AI_KEY" }).eq("id", id);
    return json({ error: "Brak klucza BARABASH_AI_KEY" }, 500);
  }

  await db.from("audits").update({ status: "running", error: null }).eq("id", id);

  // Analiza trwa 2-6 min, a gateway ścina requesty po 150 s (IDLE_TIMEOUT) —
  // odpowiadamy od razu, praca leci w tle (EdgeRuntime.waitUntil), panel polluje status.
  const work = (async () => {
  try {
    let url = String(audit.site_url).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const meta = await fetchSite(url);
    const brief = siteBrief(meta, audit.client_name, url);
    // konkurenci wpisani ręcznie w panelu (pole "Konkurenci") mają pierwszeństwo przed AI
    const manualRivals = String(audit.competitors || "")
      .split(/[,;\n]+/).map(normDomain).filter(d => d && d.includes(".")).slice(0, 4);
    // PageSpeed и палитра клиента идут параллельно с генерацией
    const psiPromise = fetchPSI(url).catch(() => null);
    const themePromise = extractTheme(meta.html, meta.finalUrl).catch(() => null);

    // Wywołanie 1: diagnoza strony
    const p1 = `Przeanalizuj stronę klienta pod kątem SEO i widoczności w AI (GEO). Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "firma": "krótka nazwa firmy",
 "branza": "branża / czym się zajmuje (kilka słów)",
 "hero": { "headline": "1 zdanie-hasło audytu w stylu: gdy klient pyta AI o [usługę], niech pada [firma]", "sub": "2 zdania: obecna sytuacja i co daje ta oferta" },
 "diagnosis": [ { "title": "3-6 słów", "text": "2-3 zdania diagnozy" } ],   // dokładnie 3 pozycje: jak rozumiemy sytuację klienta
 "metrics": [ { "value": "krótka wartość PO POLSKU: 'BRAK' / 'JEST' / 'TAK' / 'NIE' / '2 języki' (nigdy true/false)", "label": "czego dotyczy" } ],  // 4-6 metryk punktu wyjścia opartych o realne sygnały ze strony (schema, OG, canonical, hreflang, treść, blog)
 "plus": [ "co już działa — konkret ze strony" ],   // dokładnie 4
 "minus": [ "co kosztuje widoczność — konkret" ],   // dokładnie 4
 "scores": { "google": 0, "ai": 0, "technika": 0, "tresc": 0 }${manualRivals.length ? "" : `,
 "competitor_domains": [ "domena.pl" ]  // 6 kandydatów: REALNE polskie domeny BEZPOŚREDNICH konkurentów (firmy sprzedające TE SAME usługi tym samym klientom; same domeny, bez https). NIE podawaj: portali informacyjnych i mediów branżowych, marketplace'ów, katalogów firm, agregatorów prezentów, marek z tej samej grupy kapitałowej co klient ani firm/marek wymienionych na stronie klienta. Tylko firmy, których istnienia jesteś pewien; nie wymyślaj domen`}
}
Pisz zwięźle. Opieraj się TYLKO na danych ze strony. Nie wymyślaj liczb ruchu.

${brief}`;
    // Wywołanie 2: fразы, prompty AI, plan
    const p2 = `Dla tej samej strony przygotuj część ofertową audytu. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "keywords": [ { "phrase": "fraza po polsku", "intent": "informacyjna|zakupowa|lokalna|porównawcza", "potential": "wysoki|średni|niski" } ],  // dokładnie 8 fraz, którymi realni klienci szukają takich usług
 "ai_prompts": [ { "category": "nazwa kategorii", "prompts": [ "pytanie 1", "pytanie 2" ] } ],  // dokładnie 4 kategorie po 2 pytania: jak klienci pytają ChatGPT/Gemini o takie usługi
 "why_now": [ { "title": "3-6 słów", "text": "2 zdania" } ],  // dokładnie 3: dlaczego warto działać teraz
 "plan": [ { "title": "nazwa etapu", "text": "co robimy, 2 zdania", "effect": "efekt etapu, 1 zdanie" } ],  // dokładnie 3 etapy: audyt+fundament techniczny → treści+GEO → skala i pomiar
 "faq": [ { "q": "pytanie", "a": "odpowiedź 2 zdania" } ]  // dokładnie 4 najczęstsze pytania klienta o taką współpracę
}
Pisz zwięźle. Frazy i prompty mają pasować do branży klienta (wg strony). Bez wymyślonych liczb.

${brief.slice(0, 3200)}`;

    // para 1: analiza + oferta (2 równoległe — limit gatewaya)
    const [r1, r2] = await Promise.all([askJson(SYS, p1, 1200), askJson(SYS, p2, 1600)]);

    // ----- konkurenci: ręczni z panelu albo kandydaci AI + walidacja + weryfikacja -----
    const clientHost = new URL(meta.finalUrl).hostname.replace(/^www\./, "");
    const clientHtmlLc = meta.html.toLowerCase();
    const clientPhones = phonesOf(meta.html);
    // ta sama grupa/firma: wzajemne wzmianki domen/marek albo wspólny numer telefonu
    // (holding wymienia marki po nazwie bez domeny — np. "BestPharma" na greywolfgroup.pl,
    // stąd dopasowanie po bazie domeny, nie tylko po pełnej domenie)
    const GENERIC_WORDS = new Set(["group", "grupa", "polska", "poland", "company", "agency", "agencja", "studio", "academy", "akademia", "racing", "sport", "sports", "team", "biuro", "office", "serwis", "service", "online", "sklep", "store", "centrum", "center"]);
    const clientBrandTokens = [clientHost.split(".")[0], ...String(audit.client_name || "").toLowerCase().split(/[^a-z0-9]+/)]
      .filter(w => w.length >= 5 && !GENERIC_WORDS.has(w));
    const isOwnGroup = (r: Rival): boolean => {
      if (sameSite(r.domain, clientHost)) return true;
      if (clientHtmlLc.includes(r.domain)) return true;
      const rivalBase = r.domain.split(".")[0].replace(/-/g, "");
      if (rivalBase.length >= 5 && (clientHtmlLc.includes(rivalBase) || clientHtmlLc.replace(/-/g, "").includes(rivalBase))) return true;
      if (r.html) {
        const lc = r.html.toLowerCase();
        if (lc.includes(clientHost)) return true;
        for (const tok of clientBrandTokens) if (lc.includes(tok)) return true;
        const rp = phonesOf(r.html);
        for (const p of clientPhones) if (rp.has(p)) return true;
      }
      return false;
    };

    // Ręczni: bierzemy jak są. Auto: kandydaci z p1 przechodzą twarde filtry
    // (parking/redirect/cienka treść/własna grupa), a finalny wybór ≤3 robi p4
    // na realnych danych — bez dodatkowych wywołań AI (limit czasu funkcji ~150 s).
    let rivals: Rival[] = [];
    if (manualRivals.length) {
      rivals = (await Promise.all(manualRivals.filter(d => !sameSite(d, clientHost)).map(d => fetchRival(d, true))))
        .filter(Boolean) as Rival[];
    } else {
      const candDomains = (Array.isArray(r1.competitor_domains) ? r1.competitor_domains as string[] : [])
        .map(normDomain)
        .filter((d, i, a) => d && d.includes(".") && !sameSite(d, clientHost) && a.indexOf(d) === i)
        .slice(0, 8);
      const fetched = (await Promise.all(candDomains.map(d => fetchRival(d, false))))
        .filter(Boolean) as Rival[];
      rivals = fetched.filter(r => r.measured && !isOwnGroup(r)).slice(0, 5);
      console.log("audyt", id, "kandydaci:", candDomains.join(", ") || "(brak)", "→ po filtrach:", rivals.map(r => r.domain).join(", ") || "(brak)");
    }
    console.log("audyt", id, manualRivals.length ? "ręczni" : "auto", "konkurenci:", rivals.map(r => `${r.domain}${r.measured ? "" : " (bez pomiaru)"}`).join(", ") || "(brak)");

    const rivalFacts = rivals.length
      ? (manualRivals.length
          ? "KONKURENCI DO ANALIZY (używaj DOKŁADNIE tych domen jako nazw; nie dodawaj innych firm):\n"
          : "KANDYDACI NA KONKURENTÓW (dane zmierzone realnie na ich stronach):\n") +
        rivals.filter(r => r.measured).map(r =>
          `${r.domain}: profil="${(r.title || "").slice(0, 100)}", meta description ${r.hasDesc ? "jest" : "brak"}, Schema.org ${r.hasSchema ? "jest" : "brak"}, OpenGraph ${r.hasOg ? "jest" : "brak"}, hreflang ${r.hasHreflang ? "jest" : "brak"}, TTFB ~${r.ttfbMs} ms, HTML ${r.htmlKb} KB`).join("\n") +
        (rivals.some(r => !r.measured)
          ? "\n" + rivals.filter(r => !r.measured).map(r =>
              `${r.domain}: ${r.alive ? "strona działa, ale blokuje automatyczny pomiar (ochrona przed botami) — opisz jakościowo wg wiedzy o branży" : "strona nie odpowiada — opisz jakościowo wg wiedzy o branży"}`).join("\n")
          : "")
      : "Brak zmierzonych danych konkurentów — opisuj TYPY konkurentów.";

    const psi = await psiPromise;
    const speedBrief = psi
      ? `PageSpeed (mobile): wynik ${psi.score}/100, FCP ${psi.fcp?.text}, LCP ${psi.lcp?.text}, CLS ${psi.cls?.text}, TBT ${psi.tbt?.text}. Do tego: HTML ${meta.perf.htmlKb} KB, tagów <script> ${meta.perf.scripts}, obrazów ${meta.perf.imgs} (lazy: ${meta.perf.lazyImgs}), WebP: ${meta.perf.webp ? "tak" : "nie"}.`
      : `PageSpeed niedostępny. Pomiary własne: TTFB ~${meta.perf.ttfbMs} ms, HTML ${meta.perf.htmlKb} KB, tagów <script> ${meta.perf.scripts}, obrazów ${meta.perf.imgs} (lazy: ${meta.perf.lazyImgs}), WebP: ${meta.perf.webp ? "tak" : "nie"}.`;

    // Wywołanie 3: propozycje usług AI dopasowane do biznesu klienta
    const p3 = `Fastline InfinitiQ (AI-Native Agency) oferuje wdrożenia AI: agenci AI (obsługa klienta, sprzedaż),
inteligentny copywriter / generative content, automatyzacja marketingu, AI w CRM i sprzedaży (scoring, follow-upy),
integracje LLM z procesami firmy, inteligentny magazyn / prognozowanie, AI wideo i wizualizacje, brand voice AI.
Dla klienta "${audit.client_name}" (branża: ${r1.branza ?? "wg strony"}) wybierz 5 NAJLEPIEJ pasujących wdrożeń AI
i opisz je KONKRETNIE pod ten biznes. Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "ai_services": [ { "name": "nazwa usługi (np. Agent AI obsługi klienta)", "desc": "co wdrażamy u tego klienta, 2 zdania", "effect": "co to daje biznesowo, 1 zdanie", "example": "konkretny przykład działania u tego klienta, 1 zdanie" } ]
}
Pisz zwięźle, po polsku, bez ogólników — odnoś się do realiów tej branży.

Kontekst o kliencie:
${brief.slice(0, 1500)}`;

    // Wywołanie 4: konkurencja + utracone zapytania + szybkość + rekomendacje
    const p4 = `Przygotuj część konkurencyjno-naprawczą audytu dla "${audit.client_name}" (branża: ${r1.branza ?? "wg strony"}). Zwróć JSON o DOKŁADNIE tej strukturze:
{
 "competitors": [ { "name": "domena konkurenta z listy niżej (jeśli jest) lub typ konkurenta", "strengths": "czym dziś wygrywa widoczność w Google i AI — oprzyj się na zmierzonych danych, 1-2 zdania", "gap": "czego mu brakuje albo w czym klient może go wyprzedzić — konkretna szansa, 1 zdanie" } ],  // ${manualRivals.length && rivals.length ? `dokładnie ${rivals.length}: po jednym dla KAŻDEJ domeny z listy niżej, w tej samej kolejności, name = domena` : rivals.length ? `wybierz z listy niżej maksymalnie 3 domeny będące BEZPOŚREDNIMI konkurentami klienta (pomiń portale, media, katalogi, sklepy z innej branży); name = domena; jeśli żadna nie pasuje — opisz 3 TYPY konkurentów` : "dokładnie 3 TYPY konkurentów"}
 "lost_queries": [ { "query": "zapytanie klienta po polsku", "why": "dlaczego na tym zapytaniu klient trafia gdzie indziej (czego brakuje na stronie), 1 zdanie", "fix": "co wdrożyć, żeby przechwycić to zapytanie, 1 zdanie" } ],  // dokładnie 5 zapytań, na których firma DZIŚ traci klientów
 "speed_tips": [ "konkretna poprawa szybkości strony wynikająca z danych poniżej" ],  // dokładnie 4
 "recommendations": [ { "title": "3-6 słów", "text": "co dokładnie zmienić i jak, 1-2 zdania", "priority": "wysoki|średni|niski" } ]  // dokładnie 5 najważniejszych zmian (technika, treść, GEO, szybkość)
}
Pisz zwięźle. Nie wymyślaj liczb ruchu ani nazw firm, których nie znasz — wtedy opisuj TYP konkurenta.
WAŻNE: firmy i marki wymienione NA STRONIE klienta (marki jego grupy, partnerzy, submarki) NIE są konkurencją — NIGDY nie używaj ich nazw jako konkurentów.

Dane o szybkości strony: ${speedBrief}

${rivalFacts}

${brief.slice(0, 2400)}`;

    // para 2: usługi AI + konkurencja/naprawy (2 równoległe)
    const [r3, r4] = await Promise.all([askJson(SYS, p3, 900), askJson(SYS, p4, 1500)]);

    // auto: finalna lista konkurentów = domeny wybrane przez p4 z kandydatów
    if (!manualRivals.length && rivals.length) {
      const chosen = (Array.isArray(r4.competitors) ? r4.competitors as Array<Record<string, unknown>> : [])
        .map(k => normDomain(String(k?.name ?? "")));
      const picked = rivals.filter(r => chosen.includes(r.domain));
      rivals = (picked.length ? picked : rivals).slice(0, 3);
      console.log("audyt", id, "finał konkurentów:", rivals.map(r => r.domain).join(", "));
    }
    const measuredRivals = rivals.filter(r => r.measured);
    const unmeasuredRivals = rivals.filter(r => !r.measured);

    const content = {
      ...r1, ...r2, ...r3, ...r4,
      speed: { psi, local: meta.perf },
      competitor_matrix: rivals.length ? {
        client: {
          domain: clientHost, ttfbMs: meta.perf.ttfbMs, htmlKb: meta.perf.htmlKb,
          hasDesc: !!meta.desc, hasSchema: meta.signals.hasSchema, hasOg: meta.signals.hasOg,
          hasCanonical: meta.signals.hasCanonical, hasHreflang: meta.signals.hasHreflang, h1: meta.h1.length,
        },
        // do bazy tylko liczby/sygnały — bez pobranego HTML i fragmentów tekstu
        rivals: measuredRivals.map(({ html: _h, snippet: _s, h1s: _hs, title: _t, desc: _d, ...r }) => r),
        unmeasured: unmeasuredRivals.map(r => ({ domain: r.domain, alive: r.alive })),
      } : null,
    };
    // surowa lista kandydatów p1 nie jest częścią wyniku (może zawierać marki klienta)
    delete (content as Record<string, unknown>).competitor_domains;
    const theme = await themePromise;
    await db.from("audits").update({
      status: "ready",
      content,
      logo_url: meta.logo || null,
      site_meta: { title: meta.title, desc: meta.desc, finalUrl: meta.finalUrl, signals: meta.signals, theme },
      generated_at: new Date().toISOString(),
      error: null,
    }).eq("id", id);
    console.log("audyt", id, "gotowy");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("audyt", id, "błąd:", msg);
    await db.from("audits").update({ status: "error", error: msg }).eq("id", id);
  }
  })();

  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(work);
  else await work;
  return json({ ok: true, id, status: "running" });
});
