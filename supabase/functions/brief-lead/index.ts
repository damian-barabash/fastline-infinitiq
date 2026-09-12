// brief-lead v1 — formularz kontaktu na /kontakt: dwa kroki zamiast jednego maila.
//
// Przepływ (dokładnie tak, jak widzi go klient):
//   1. dane + adres strony  → `site.check` (ta sama próba co przy audycie)
//   2. „Dalej"              → `analyze`: pobieramy stronę, jednym wywołaniem modelu
//                             piszemy PROFIL firmy i JAK POMOŻEMY (pod wybrany produkt,
//                             a gdy klient nic nie zaznaczył — dobieramy jeden sami).
//                             Budżet twardy: ~6,5 s, bo front trzyma animację 7 s.
//   3. kalendarz            → `book`: rezerwacja terminu rozmowy + potwierdzenie mailem
//   4. godzinę wcześniej    → `remind` (pg_cron) przypomina klientowi
//
// Zgłoszenia lądują w `public.brief_leads` — zakładka „Briefingi" w edytorze.
// Funkcja jest publiczna (verify_jwt off), więc każda akcja ma limity na IP i adres.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE = "https://fastlineinfinitiq.pl";
const LOGO = `${SITE}/assets/logo/LOGO.png`;
const RESEND_KEY = Deno.env.get("RESEND_KEY") ?? "";
const MAIL_FROM = Deno.env.get("AUDIT_MAIL_FROM") ?? "Fastline InfinitiQ <audyt@fastlineinfinitiq.pl>";
const NOTIFY_TO = Deno.env.get("AUDIT_LEAD_NOTIFY_TO") ?? "";
const CRON_KEY = Deno.env.get("AUDIT_CRON_KEY") ?? "";
const AI_URL = (Deno.env.get("BARABASH_AI_URL") ?? "").replace(/\/+$/, "");
const AI_KEY = Deno.env.get("BARABASH_AI_KEY") ?? "";
const AI_MODEL = Deno.env.get("AUDIT_MODEL") ?? "qwen3.5:9b";

const TZ = "Europe/Warsaw";
const MAX_ANALYZE_IP_24H = 8;     // analiz z jednego IP na dobę
const BUDGET_MS = 7200;           // cały `analyze` — front trzyma animację do ~9 s
const DAY_START = 9, DAY_END = 17, STEP_MIN = 30, LEAD_HOURS = 3, DAYS_AHEAD = 12, DAYS_SHOWN = 6;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* Klient wybiera PROBLEM, nie nazwę produktu (2026-09-11). Ta mapa mówi
   modelowi, o których produktach ma pisać. ⚠️ Bliźniacza lista siedzi w
   `src/engine/briefPains.js` — zmiana w jednym miejscu wymaga drugiego. */
const PAINS: { label: string; products: string[] }[] = [
  { label: "Zapytania czekają do rana", products: ["AI Sprzedawca", "AI Recepcja 24/7"] },
  { label: "Telefon dzwoni, gdy nie ma kto odebrać", products: ["AI Recepcja 24/7"] },
  { label: "Klient nie wie, który wariant wybrać", products: ["AI Doradca"] },
  { label: "Oferta powstaje zbyt wolno", products: ["AI Generator Ofert"] },
  { label: "Brakuje nowych leadów", products: ["AI Łowca Leadów"] },
  { label: "Nie wiadomo, kogo ruszyć pierwszego", products: ["AI CRM"] },
  { label: "Reklamy palą budżet bez wyniku", products: ["AI Kampanie Reklamowe"] },
  { label: "Nie ma kto prowadzić treści", products: ["AI Fabryka Kontentu"] },
  { label: "Nie widać nas w Google i w AI", products: ["AI Pilot Widoczności"] },
  { label: "Opinie zostają bez odpowiedzi", products: ["AI Strażnik Reputacji"] },
  { label: "Klient kupuje raz i znika", products: ["AI Fabryka Lojalności"] },
  { label: "Te same pytania wracają w kółko", products: ["AI Asystent", "AI Academy"] },
  { label: "Dane rozrzucone po arkuszach", products: ["AI  Centrum Danych"] },
  { label: "Terminy i zadania się gubią", products: ["AI Project Manager"] },
  { label: "Braki albo zator w magazynie", products: ["Inteligentny Magazyn"] },
  { label: "Rekrutacja zjada tygodnie", products: ["Rekruter AI"] },
  { label: "Nie wiemy, co robi konkurencja", products: ["AI Market Radar"] },
];
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
function productsForPains(labels: string[]): string[] {
  const out: string[] = [];
  labels.forEach(l => {
    const hit = PAINS.find(p => norm(p.label) === norm(l));
    (hit?.products ?? []).forEach(n => { if (!out.includes(n)) out.push(n); });
  });
  return out;
}

// ─────────────────────────────────────────────────────────── strona klienta

function normalizeUrl(raw: string): string | null {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  return u.origin + (u.pathname === "/" ? "" : u.pathname);
}

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };

async function tryFetch(url: string, ms: number) {
  return await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "pl,en;q=0.8" },
    signal: AbortSignal.timeout(ms),
  });
}

/** Czy strona istnieje (https → www/bez-www → http). 401/403 = „żyje" (Cloudflare). */
async function probeSite(raw: string, ms = 9000): Promise<{ ok: boolean; url?: string; host?: string; title?: string; html?: string; reason?: string }> {
  const norm = normalizeUrl(raw);
  if (!norm) return { ok: false, reason: "To nie wygląda na adres strony — wpisz np. moja-firma.pl" };
  const u = new URL(norm);
  const bare = u.hostname.replace(/^www\./, "");
  const candidates = [
    norm,
    u.protocol + "//" + (u.hostname.startsWith("www.") ? bare : "www." + bare) + (u.pathname === "/" ? "" : u.pathname),
    "http://" + bare,
  ];
  let lastReason = "Nie udało się otworzyć tej strony";
  for (const cand of candidates) {
    try {
      const r = await tryFetch(cand, ms);
      if (r.status >= 500) { lastReason = `Strona odpowiada błędem ${r.status}`; continue; }
      const html = r.status < 400 ? (await r.text().catch(() => "")).slice(0, 400_000) : "";
      const title = (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "")
        .replace(/\s+/g, " ").trim().slice(0, 140);
      return { ok: true, url: r.url || cand, host: hostOf(r.url || cand), title, html };
    } catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      lastReason = /timeout|abort/i.test(m)
        ? "Strona nie odpowiedziała na czas"
        : /dns|resolve|name/i.test(m)
          ? "Taka domena nie istnieje albo nie działa"
          : "Nie udało się otworzyć tej strony";
    }
  }
  return { ok: false, reason: lastReason };
}

/** Widoczny tekst strony — bez skryptów, styli i znaczników. */
function visibleText(html: string, cap = 1600): string {
  const body = (html.match(/<body[\s\S]*?>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  return body.slice(0, cap);
}

const metaDesc = (html: string) =>
  (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([\s\S]{0,400}?)["']/i)?.[1]
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([\s\S]{0,400}?)["']/i)?.[1]
    ?? "").replace(/\s+/g, " ").trim();

// ───────────────────────────────────────────────────────────────── model

/** Jedno wywołanie modelu z twardym limitem czasu. Pusto = idziemy na tekst zapasowy. */
async function askAI(prompt: string, ms: number, maxTokens = 300): Promise<string> {
  if (!AI_URL || !AI_KEY || ms < 600) return "";
  const base = AI_URL.endsWith("/v1") ? AI_URL : AI_URL + "/v1";
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${AI_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: maxTokens,
        stream: false,
        think: false,     // ⚠️ bez tego qwen3.5 dokłada tokeny „rozmyślania" i nie mieści się w 7 s
      }),
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) { console.error("AI", r.status, (await r.text().catch(() => "")).slice(0, 200)); return ""; }
    const data = await r.json().catch(() => ({}));
    return String((data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "");
  } catch (e) {
    console.error("AI timeout/err:", String(e).slice(0, 160));
    return "";
  }
}

/** Model lubi dokleić prozę wokół JSON-a — wyjmujemy pierwszy obiekt. */
function parseJson(raw: string): Record<string, string> {
  const s = raw.replace(/```json|```/gi, "").trim();
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i < 0 || j <= i) return {};
  try { return JSON.parse(s.slice(i, j + 1)); } catch { /* ignore */ }
  try { return JSON.parse(s.slice(i, j + 1).replace(/,\s*}/g, "}").replace(/\n/g, " ")); } catch { return {}; }
}

// ────────────────────────────────────────────────────────────────── terminy

/** Przesunięcie strefy w minutach dla danej chwili (Polska: +60 albo +120). */
function tzOffsetMin(d: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUtc - d.getTime()) / 60000;
}

/** Lokalna data/godzina w Warszawie → instant UTC (z korektą przy zmianie czasu). */
function warsawToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min) - 60 * 60000);
  const off = tzOffsetMin(guess);
  const exact = new Date(Date.UTC(y, m - 1, d, h, min) - off * 60000);
  const off2 = tzOffsetMin(exact);
  return off2 === off ? exact : new Date(Date.UTC(y, m - 1, d, h, min) - off2 * 60000);
}

const partsIn = (d: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
}).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);

const dayLabel = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
const timeLabel = (d: Date) => new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
const fullLabel = (d: Date) => new Intl.DateTimeFormat("pl-PL", {
  timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
}).format(d);

/** Wolne terminy: pn–pt, 9:00–17:00 co pół godziny, od „teraz + 3 h". */
function buildSlots(taken: Set<string>): { key: string; label: string; slots: { iso: string; label: string }[] }[] {
  const out: { key: string; label: string; slots: { iso: string; label: string }[] }[] = [];
  const from = Date.now() + LEAD_HOURS * 3600_000;
  for (let i = 0; i < DAYS_AHEAD && out.length < DAYS_SHOWN; i++) {
    const probe = new Date(Date.now() + i * 86400_000);
    const p = partsIn(probe);
    const wd = p.weekday;
    if (wd === "Sat" || wd === "Sun") continue;
    const y = +p.year, m = +p.month, d = +p.day;
    const slots: { iso: string; label: string }[] = [];
    for (let h = DAY_START; h < DAY_END; h++) {
      for (let mi = 0; mi < 60; mi += STEP_MIN) {
        const t = warsawToUtc(y, m, d, h, mi);
        if (t.getTime() < from) continue;
        const iso = t.toISOString();
        if (taken.has(iso)) continue;
        slots.push({ iso, label: timeLabel(t) });
      }
    }
    if (slots.length) out.push({ key: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, label: dayLabel(warsawToUtc(y, m, d, 12, 0)), slots });
  }
  return out;
}

async function freeSlots(db: SupabaseClient) {
  const { data } = await db.from("brief_leads")
    .select("slot_at").eq("status", "booked").gte("slot_at", new Date().toISOString());
  const taken = new Set((data ?? []).map(r => new Date(String(r.slot_at)).toISOString()));
  return buildSlots(taken);
}

// ───────────────────────────────────────────────────────────────── e-maile

function shell(inner: string, preheader: string): string {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0D0D0D;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111211;border:1px solid rgba(184,255,0,0.18);">
  <tr><td style="padding:26px 30px 0;">
    <img src="${LOGO}" alt="Fastline InfinitiQ" width="168" style="display:block;width:168px;height:auto;border:0;">
  </td></tr>
  ${inner}
  <tr><td style="padding:22px 30px 26px;border-top:1px solid rgba(245,245,240,0.10);">
    <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(245,245,240,0.42);">
      Fastline InfinitiQ · AI-Native Agency
    </p>
    <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:rgba(245,245,240,0.42);">
      Część <a href="https://greywolfgroup.pl/" style="color:#B8FF00;text-decoration:none;">Greywolf Group</a> ·
      <a href="${SITE}" style="color:#B8FF00;text-decoration:none;">fastlineinfinitiq.pl</a>
    </p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

const block = (label: string, h1: string, body: string) => `
  <tr><td style="padding:26px 30px 0;">
    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B8FF00;">${esc(label)}</p>
    <h1 style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.15;text-transform:uppercase;color:#F5F5F0;">${esc(h1)}</h1>
    ${body}
  </td></tr>
  <tr><td style="padding:20px 30px 24px;"></td></tr>`;

const para = (html: string) =>
  `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(245,245,240,0.86);">${html}</p>`;

function mailConfirm(lead: Record<string, unknown>, when: Date) {
  return {
    subject: `Rozmowa ${fullLabel(when)} — Fastline InfinitiQ`,
    html: shell(block("Termin potwierdzony", "Do usłyszenia", `
      ${para(`Rezerwujemy dla Was <strong style="color:#F5F5F0;">${esc(fullLabel(when))}</strong>. Rozmowa trwa około 30 minut — dzwonimy my.`)}
      ${lead.pomoc ? para(`<strong style="color:#F5F5F0;">Od czego zaczniemy:</strong> ${esc(String(lead.pomoc))}`) : ""}
      ${para(`Godzinę wcześniej przyślemy krótkie przypomnienie. Jeśli termin przestanie pasować — odpisz na tę wiadomość, przestawimy.`)}
    `), `Rozmowa ${fullLabel(when)}`),
  };
}

function mailRemind(lead: Record<string, unknown>, when: Date) {
  return {
    subject: `Za godzinę rozmowa — ${timeLabel(when)}`,
    html: shell(block("Przypomnienie", "Rozmowa za godzinę", `
      ${para(`Dziś o <strong style="color:#F5F5F0;">${esc(timeLabel(when))}</strong> dzwonimy w sprawie ${lead.company ? esc(String(lead.company)) : esc(String(lead.site_host ?? "Waszej firmy"))}.`)}
      ${para(`Nic nie trzeba przygotowywać. Jeśli coś wypadło — odpisz na tę wiadomość, przestawimy termin.`)}
    `), `Rozmowa o ${timeLabel(when)}`),
  };
}

function mailUs(lead: Record<string, unknown>, when: Date) {
  const row = (k: string, v: string) => v
    ? `<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:rgba(245,245,240,0.86);">
         <span style="color:rgba(245,245,240,0.5);">${esc(k)}:</span> ${esc(v)}</p>` : "";
  return {
    subject: `Nowy briefing: ${String(lead.company || lead.site_host || lead.email)} — ${fullLabel(when)}`,
    html: shell(block("Briefing z /kontakt", "Nowe zgłoszenie", `
      ${row("Termin", fullLabel(when))}
      ${row("Osoba", String(lead.name ?? ""))}
      ${row("Firma", String(lead.company ?? ""))}
      ${row("E-mail", String(lead.email ?? ""))}
      ${row("Strona", String(lead.site_url ?? ""))}
      ${row("Co go boli", ((lead.pains as string[]) ?? []).join(" · "))}
      ${row("Pasujące produkty", ((lead.products as string[]) ?? []).join(", "))}
      ${row("Dobrany produkt", String(lead.rec_product ?? ""))}
      ${lead.profil ? para(`<strong style="color:#F5F5F0;">Profil:</strong> ${esc(String(lead.profil))}`) : ""}
      ${lead.pomoc ? para(`<strong style="color:#F5F5F0;">Jak pomożemy:</strong> ${esc(String(lead.pomoc))}`) : ""}
    `), `Briefing ${fullLabel(when)}`),
  };
}

async function sendMail(to: string, subject: string, html: string, replyTo?: string) {
  if (!RESEND_KEY) return { ok: false, error: "brak RESEND_KEY" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${RESEND_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${JSON.stringify(data).slice(0, 200)}` };
    return { ok: true, id: (data as { id?: string })?.id };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

// ───────────────────────────────────────────────────────────────── handler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = String(body.action ?? "");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 45);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const nowIso = () => new Date().toISOString();

  try {
    // ── 1. czy strona istnieje ──────────────────────────────────────────────
    if (action === "site.check") {
      const p = await probeSite(String(body.site ?? ""));
      return json(p.ok ? { ok: true, url: p.url, host: p.host, title: p.title } : { ok: false, reason: p.reason });
    }

    // ── 2. analiza w locie (front trzyma animację do 7 s) ────────────────────
    if (action === "analyze") {
      const t0 = Date.now();
      const left = () => BUDGET_MS - (Date.now() - t0);

      const name = String(body.name ?? "").trim().slice(0, 120);
      const company = String(body.company ?? "").trim().slice(0, 160);
      const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
      // `pains` to nowy format (klient wybiera problem); `products` zostaje dla
      // zgodności ze starą wersją strony, która mogła jeszcze wisieć w przeglądarce
      const pains = Array.isArray(body.pains) ? (body.pains as unknown[]).map(p => String(p).slice(0, 120)).slice(0, 12) : [];
      const products = pains.length
        ? productsForPains(pains)
        : (Array.isArray(body.products) ? (body.products as unknown[]).map(p => String(p).slice(0, 80)).slice(0, 12) : []);
      if (!EMAIL_RE.test(email)) return json({ ok: false, reason: "Ten adres e-mail wygląda na niepoprawny", field: "email" }, 400);

      const { count } = await db.from("brief_leads")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip).gte("created_at", new Date(Date.now() - 86400_000).toISOString());
      if (ip && (count ?? 0) >= MAX_ANALYZE_IP_24H)
        return json({ ok: false, reason: "Dziś mamy już kilka zgłoszeń z tego adresu. Napisz do nas wprost: infinitiq@fastline.pl" }, 429);

      // strona i katalog równolegle — oba są nam potrzebne do tekstu
      const [probe, cat] = await Promise.all([
        probeSite(String(body.site ?? ""), 2300),
        db.from("audit_catalog").select("name, tagline, problem, effect, group_name").eq("hidden", false).order("sort").limit(30),
      ]);
      if (!probe.ok) return json({ ok: false, reason: probe.reason, field: "site" }, 400);

      const catalog = (cat.data ?? []) as { name: string; tagline: string; problem?: string; effect?: string; group_name?: string }[];
      const chosen = products.filter(p => p && !/nie wiem/i.test(p));
      const known = catalog.filter(c => chosen.some(p => p.toLowerCase() === String(c.name).toLowerCase()));

      const text = visibleText(probe.html ?? "");
      const desc = metaDesc(probe.html ?? "");
      // Gdy klient wskazał problemy, model nie potrzebuje CAŁEGO katalogu — tylko
      // pasujących produktów. Krótszy prompt = szybsza odpowiedź (budżet 7 s).
      const forPrompt = (known.length ? known : catalog);
      const listForAi = forPrompt.map(c => `- ${c.name}: ${c.tagline}`).join("\n").slice(0, 900);

      const prompt = `Strona firmy ${probe.host}:
${probe.title ?? ""} | ${desc}
${text}

Produkty Fastline InfinitiQ:
${listForAi}

${pains.length
  ? `Klient wskazał problemy: ${pains.join("; ")}. Rozwiązują je: ${(known.length ? known.map(k => k.name) : products).join(", ")}. Pisz o TYCH produktach, w języku jego problemu.`
  : known.length
    ? `Klient wybrał: ${known.map(k => k.name).join(", ")}.`
    : "Klient nic nie wybrał — dobierz JEDEN produkt z listy."}

Po polsku, konkretnie, bez lania wody. Odpowiedz samym JSON-em:
{"profil":"1-2 zdania czym ta firma się zajmuje i dla kogo","pomoc":"2 zdania co u nich zrobi ${known.length ? "wybrany produkt" : "dobrany produkt"} i co to zmieni","produkt":"${known.length ? "" : "nazwa produktu"}"}`;

      const aiT0 = Date.now();
      let raw = await askAI(prompt, Math.min(5200, Math.max(0, left() - 350)), 200);
      // Pusta odpowiedź po ułamku sekundy to nie timeout, tylko 429 z bramki
      // (klucz `fiq-audit` dzielimy z audytami) — jedna szybka druga próba,
      // ale tylko jeśli w budżecie zostało realne miejsce.
      if (!raw && left() > 2000) {
        await new Promise(r => setTimeout(r, 350));
        raw = await askAI(prompt, Math.min(4200, Math.max(0, left() - 300)), 200);
      }
      const got = parseJson(raw);
      const aiMs = Date.now() - aiT0;

      // tekst zapasowy — gdy model nie zdążył: i tak mówimy coś prawdziwego
      const fallbackProfile = desc || probe.title || `Firma ze strony ${probe.host}`;
      const pick = known[0] ?? catalog.find(c => /doradca|sprzedawca/i.test(c.name)) ?? catalog[0];
      // Tekst zapasowy ma się czytać jak zdanie, a nie jak wklejka z katalogu
      const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
      const fallbackHelp = pick
        ? `Zaczniemy od jednego ruchu: ${pick.name}. ${cap(pick.tagline ?? "")}${pick.effect ? ` ${cap(pick.effect)}` : ""}`.replace(/\s+/g, " ").trim()
        : "Pokażemy, który proces u Was pierwszy przejmie AI i ile to kosztuje.";

      const profil = String(got.profil ?? "").trim().slice(0, 700) || String(fallbackProfile).slice(0, 700);
      const pomoc = String(got.pomoc ?? "").trim().slice(0, 900) || fallbackHelp;
      const recProduct = known.length ? "" : (String(got.produkt ?? "").trim().slice(0, 80) || (pick?.name ?? ""));

      const { data: lead, error } = await db.from("brief_leads").insert({
        name, company, email,
        site_url: probe.url, site_host: probe.host, site_title: probe.title,
        products: chosen, pains, profil, pomoc, rec_product: recProduct,
        status: "new", ip, ua,
      }).select("id").single();
      if (error) return json({ ok: false, reason: "Nie udało się zapisać zgłoszenia. Spróbuj jeszcze raz." }, 500);

      return json({
        ok: true, lead_id: lead.id, host: probe.host,
        profil, pomoc, produkt: recProduct, products: chosen, pains,
        days: await freeSlots(db),
        ms: Date.now() - t0, ai_ms: aiMs, ai: !!got.profil,   // podgląd dla nas, front tego nie pokazuje
      });
    }

    // ── 3. wolne terminy (gdy klient wraca do kalendarza) ────────────────────
    if (action === "slots") return json({ ok: true, days: await freeSlots(db) });

    // ── 4. rezerwacja ───────────────────────────────────────────────────────
    if (action === "book") {
      const id = String(body.lead_id ?? "");
      const slot = String(body.slot ?? "");
      if (!id || !slot) return json({ ok: false, reason: "Brak terminu" }, 400);
      const when = new Date(slot);
      if (isNaN(when.getTime())) return json({ ok: false, reason: "Nieznany termin" }, 400);

      const days = await freeSlots(db);
      const iso = when.toISOString();
      const valid = days.some(d => d.slots.some(s => s.iso === iso));
      if (!valid) return json({ ok: false, reason: "Ten termin właśnie zniknął — wybierz inny.", days }, 409);

      const { data: lead, error } = await db.from("brief_leads")
        .update({ slot_at: iso, status: "booked", updated_at: nowIso() })
        .eq("id", id).select("*").single();
      if (error || !lead) return json({ ok: false, reason: "Nie znaleźliśmy tego zgłoszenia" }, 404);

      const c = mailConfirm(lead, when);
      const sent = await sendMail(String(lead.email), c.subject, c.html);
      if (sent.ok) await db.from("brief_leads").update({ confirm_mail_at: nowIso() }).eq("id", id);
      if (NOTIFY_TO) {
        const u = mailUs(lead, when);
        const us = await sendMail(NOTIFY_TO, u.subject, u.html, String(lead.email));
        if (us.ok) await db.from("brief_leads").update({ notify_mail_at: nowIso() }).eq("id", id);
      }
      return json({ ok: true, slot: iso, label: fullLabel(when), mailed: sent.ok });
    }

    // ── 5. pg_cron: przypomnienie godzinę przed ─────────────────────────────
    if (action === "remind") {
      if (!CRON_KEY || body.cron_key !== CRON_KEY) return json({ error: "forbidden" }, 403);
      const from = new Date(Date.now() + 50 * 60000).toISOString();
      const to = new Date(Date.now() + 70 * 60000).toISOString();
      const { data: soon } = await db.from("brief_leads")
        .select("*").eq("status", "booked").is("remind_mail_at", null)
        .gte("slot_at", from).lte("slot_at", to).limit(20);
      let sent = 0;
      for (const l of soon ?? []) {
        const when = new Date(String(l.slot_at));
        const m = mailRemind(l, when);
        const r = await sendMail(String(l.email), m.subject, m.html);
        if (r.ok) { await db.from("brief_leads").update({ remind_mail_at: nowIso(), updated_at: nowIso() }).eq("id", l.id); sent++; }
        else console.error("przypomnienie nie wyszło:", l.email, r.error);
      }
      return json({ ok: true, sent });
    }

    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("brief-lead:", msg);
    return json({ ok: false, reason: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę." }, 500);
  }
});
