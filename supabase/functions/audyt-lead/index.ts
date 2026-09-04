// audyt-lead v1 — publiczny formularz „darmowy audyt" z sekcji 06 lendingu.
//
// Przepływ (dokładnie w tej kolejności, tak jak na stronie):
//   1. e-mail            → walidacja składni
//   2. adres strony      → `site.check`: naprawdę pobieramy stronę i sprawdzamy, że odpowiada
//   3. kod 4-cyfrowy     → `code.send` (Resend) i `code.verify`
//   4. po weryfikacji    → wiersz w `public.audits` ze statusem `queued`
//                          (pg_cron `audit-queue-drain` startuje go sam) + powiadomienie do nas
//   5. gdy audyt gotowy  → `notify` (pg_cron) wysyła klientowi brandowany e-mail z linkiem
//
// Funkcja jest publiczna (verify_jwt off), więc każda akcja ma limity: odstęp między
// kodami, dobowy limit wysyłek na adres i na IP, 5 prób wpisania kodu.
// Kod nie jest trzymany jawnie — w bazie leży SHA-256 z solą (sekret AUDIT_INTERNAL_KEY).
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
const SALT = Deno.env.get("AUDIT_INTERNAL_KEY") ?? "fiq-audyt-salt";

// limity antyspamowe
const RESEND_GAP_MS = 60_000;   // odstęp między dwoma kodami na ten sam adres
const MAX_SENDS_24H = 5;        // kodów na adres na dobę
const MAX_LEADS_IP_24H = 6;     // zgłoszeń z jednego IP na dobę
const MAX_CODE_TRIES = 5;       // prób wpisania kodu
const CODE_TTL_MIN = 20;        // ważność kodu
const REUSE_AUDIT_DAYS = 30;    // gotowy audyt tej domeny młodszy niż X dni — wysyłamy istniejący

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// ─────────────────────────────────────────────────────────── strona klienta

/** Adres bez schematu też ma działać („moja-firma.pl"), tak wpisuje większość ludzi. */
function normalizeUrl(raw: string): string | null {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase();
  // odrzucamy adresy, które nie są publiczną stroną firmy
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  return u.origin + (u.pathname === "/" ? "" : u.pathname);
}

const hostOf = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function tryFetch(url: string, ms: number) {
  return await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "pl,en;q=0.8" },
    signal: AbortSignal.timeout(ms),
  });
}

/**
 * Czy strona istnieje. Kolejność prób: https → https bez www / z www → http.
 * 401/403 traktujemy jako „żyje" — to zwykle Cloudflare, a nie brak strony.
 */
async function probeSite(raw: string): Promise<{ ok: boolean; url?: string; host?: string; title?: string; reason?: string }> {
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
      const r = await tryFetch(cand, 9000);
      if (r.status >= 500) { lastReason = `Strona odpowiada błędem ${r.status}`; continue; }
      const html = r.status < 400 ? (await r.text().catch(() => "")).slice(0, 200_000) : "";
      const title = (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "")
        .replace(/\s+/g, " ").trim().slice(0, 120);
      return { ok: true, url: r.url || cand, host: hostOf(r.url || cand), title };
    } catch (e) {
      const m = String(e instanceof Error ? e.message : e);
      lastReason = /timeout|abort/i.test(m)
        ? "Strona nie odpowiedziała w 9 sekund"
        : /dns|resolve|name/i.test(m)
          ? "Taka domena nie istnieje albo nie działa"
          : "Nie udało się otworzyć tej strony";
    }
  }
  return { ok: false, reason: lastReason };
}

// ─────────────────────────────────────────────────────────────────── kod

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const codeHash = (code: string, email: string) => sha256(`${code}:${email.toLowerCase()}:${SALT}`);
const newCode = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));

// ───────────────────────────────────────────────────────────────── e-maile

/** Wspólna koperta wszystkich wiadomości: ciemne tło, kwasowy akcent, logo z lendingu. */
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

function mailCode(code: string, host: string): { subject: string; html: string } {
  const cells = code.split("").map(d =>
    `<td style="padding:0 5px;"><div style="width:56px;height:66px;background:#0D0D0D;border:1px solid rgba(184,255,0,0.45);
      font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:32px;line-height:66px;text-align:center;color:#B8FF00;">${d}</div></td>`).join("");
  return {
    subject: `Twój kod: ${code} — audyt ${host}`,
    html: shell(`
  <tr><td style="padding:26px 30px 0;">
    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B8FF00;">Krok 3 z 3 — potwierdzenie</p>
    <h1 style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.15;text-transform:uppercase;color:#F5F5F0;">Twój kod do audytu</h1>
    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(245,245,240,0.86);">
      Wpisz ten kod na stronie, żeby uruchomić bezpłatny audyt strony <strong style="color:#F5F5F0;">${esc(host)}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>${cells}</tr></table>
    <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(245,245,240,0.55);">
      Kod jest ważny ${CODE_TTL_MIN} minut. Jeśli to nie Ty prosiłeś o audyt — po prostu zignoruj tę wiadomość.
    </p>
  </td></tr>
  <tr><td style="padding:20px 30px 24px;"></td></tr>`, `Kod ${code} — ważny ${CODE_TTL_MIN} minut`),
  };
}

function mailReady(slug: string, host: string): { subject: string; html: string } {
  const url = `${SITE}/audyt/${slug}`;
  return {
    subject: `Audyt ${host} jest gotowy`,
    html: shell(`
  <tr><td style="padding:26px 30px 0;">
    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B8FF00;">Gotowe</p>
    <h1 style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.15;text-transform:uppercase;color:#F5F5F0;">Twój audyt jest gotowy</h1>
    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(245,245,240,0.86);">
      Przeanalizowaliśmy <strong style="color:#F5F5F0;">${esc(host)}</strong>: widoczność w Google i w modelach AI,
      technikę, treść, konkurencję i to, gdzie realnie tracicie zapytania. W raporcie jest też plan naprawy
      i wycena wdrożeń dopasowanych do Waszej sytuacji.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr><td style="background:#B8FF00;">
      <a href="${url}" style="display:block;padding:16px 34px;font-family:'Courier New',monospace;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#0D0D0D;text-decoration:none;font-weight:700;">Zobacz swój audyt →</a>
    </td></tr></table>
    <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(245,245,240,0.55);">
      Link działa bez logowania: <a href="${url}" style="color:#B8FF00;text-decoration:none;">${esc(url)}</a>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:2px solid #B8FF00;background:rgba(184,255,0,0.06);">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:rgba(245,245,240,0.90);">
          <strong style="color:#F5F5F0;">Co dalej?</strong> Odezwiemy się w ciągu 24 godzin roboczych i przejdziemy przez raport razem —
          bez zobowiązań. Jeśli chcesz wcześniej, po prostu odpisz na tę wiadomość.
        </p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:22px 30px 24px;"></td></tr>`, `Raport dla ${host} — gotowy do otwarcia`),
  };
}

function mailFail(host: string): { subject: string; html: string } {
  return {
    subject: `Audyt ${host} — potrzebujemy chwili`,
    html: shell(`
  <tr><td style="padding:26px 30px 0;">
    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B8FF00;">Status</p>
    <h1 style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.15;text-transform:uppercase;color:#F5F5F0;">Analiza wymaga naszej ręki</h1>
    <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:rgba(245,245,240,0.86);">
      Automat nie domknął audytu strony <strong style="color:#F5F5F0;">${esc(host)}</strong> — to zwykle znaczy, że strona
      mocno broni się przed robotami albo ładuje treść skryptem. Zajmiemy się tym ręcznie i odezwiemy się
      w ciągu 24 godzin roboczych z gotowym raportem.
    </p>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:rgba(245,245,240,0.55);">
      Nic nie musisz robić. Możesz też po prostu odpisać na tę wiadomość.
    </p>
  </td></tr>
  <tr><td style="padding:22px 30px 24px;"></td></tr>`, `Audyt ${host} — zajmiemy się nim ręcznie`),
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

// ─────────────────────────────────────────────────────────────────── audyt

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

async function freeSlug(db: SupabaseClient, host: string): Promise<string> {
  const base = slugify(host.replace(/\.(pl|com|eu|net|org|info|biz|shop|store|co\.uk|de)$/i, "")) || "audyt";
  for (let i = 0; i < 40; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await db.from("audits").select("id").eq("slug", cand).maybeSingle();
    if (!data) return cand;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Natychmiast ruszamy kolejką, żeby klient nie czekał do pełnej minuty crona. */
async function kickQueue(supaUrl: string, anon: string) {
  if (!CRON_KEY) return;
  try {
    await fetch(`${supaUrl}/functions/v1/audit-run`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ action: "drain", cron_key: CRON_KEY }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch { /* cron i tak dojedzie za minutę */ }
}

async function notifyUs(lead: Record<string, unknown>, slug: string, reused: boolean) {
  if (!NOTIFY_TO) return;
  const host = String(lead.site_host ?? "");
  await sendMail(
    NOTIFY_TO,
    `Nowy lead z lendingu: ${host}`,
    shell(`
  <tr><td style="padding:26px 30px 24px;">
    <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#B8FF00;">Nowy lead — darmowy audyt</p>
    <h1 style="margin:0 0 16px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;font-size:24px;line-height:1.2;text-transform:uppercase;color:#F5F5F0;">${esc(host)}</h1>
    <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(245,245,240,0.90);">E-mail: <a href="mailto:${esc(String(lead.email))}" style="color:#B8FF00;text-decoration:none;">${esc(String(lead.email))}</a></p>
    <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(245,245,240,0.90);">Strona: <a href="${esc(String(lead.site_url))}" style="color:#B8FF00;text-decoration:none;">${esc(String(lead.site_url))}</a></p>
    <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(245,245,240,0.90);">Audyt: <a href="${SITE}/audyt/${slug}" style="color:#B8FF00;text-decoration:none;">/audyt/${esc(slug)}</a>${reused ? " (istniejący, wysłany od razu)" : " (w kolejce)"}</p>
    <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:rgba(245,245,240,0.55);">Klient dostał obietnicę kontaktu w 24 h roboczych.</p>
  </td></tr>`, `${host} — ${String(lead.email)}`),
    String(lead.email),
  );
}

// ────────────────────────────────────────────────────────────────── handler

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supaUrl, service);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* noop */ }
  const action = String(body.action ?? "");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 45);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 200);
  const nowIso = () => new Date().toISOString();
  const since = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  try {
    // ── 1. czy strona istnieje ──────────────────────────────────────────────
    if (action === "site.check") {
      const p = await probeSite(String(body.site ?? ""));
      return json(p.ok ? { ok: true, url: p.url, host: p.host, title: p.title } : { ok: false, reason: p.reason });
    }

    // ── 2. wyślij kod ───────────────────────────────────────────────────────
    if (action === "code.send") {
      const email = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
      if (!EMAIL_RE.test(email)) return json({ ok: false, reason: "Ten adres e-mail wygląda na niepoprawny" }, 400);

      const probe = await probeSite(String(body.site ?? ""));
      if (!probe.ok) return json({ ok: false, reason: probe.reason, field: "site" }, 400);
      const host = probe.host!;

      // limity: odstęp, doba na adres, doba na IP
      const { data: recent } = await db.from("audit_leads")
        .select("id, sends, last_send_at, status, audit_id")
        .eq("email", email).gte("created_at", since(24))
        .order("created_at", { ascending: false });
      const sends24 = (recent ?? []).reduce((n, r) => n + (Number(r.sends) || 0), 0);
      if (sends24 >= MAX_SENDS_24H)
        return json({ ok: false, reason: "Dziś wysłaliśmy już kilka kodów na ten adres. Napisz do nas bezpośrednio: infinitiq@fastline.pl" }, 429);
      const last = (recent ?? []).find(r => r.last_send_at);
      if (last?.last_send_at && Date.now() - new Date(String(last.last_send_at)).getTime() < RESEND_GAP_MS)
        return json({ ok: false, reason: "Kod już poszedł — sprawdź skrzynkę. Kolejny możesz zamówić za minutę." }, 429);
      if (ip) {
        const { count } = await db.from("audit_leads").select("id", { count: "exact", head: true })
          .eq("ip", ip).gte("created_at", since(24));
        if ((count ?? 0) >= MAX_LEADS_IP_24H)
          return json({ ok: false, reason: "Zbyt wiele zgłoszeń z tego łącza. Napisz do nas: infinitiq@fastline.pl" }, 429);
      }

      const code = newCode();
      const patch = {
        email, site_url: probe.url!, site_host: host,
        client_name: (probe.title || host).slice(0, 120),
        code_hash: await codeHash(code, email),
        code_expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
        code_attempts: 0, last_send_at: nowIso(), ip, ua, updated_at: nowIso(),
      };

      // ten sam adres + ta sama domena i jeszcze niepotwierdzony → odświeżamy wiersz
      const { data: open } = await db.from("audit_leads")
        .select("id, sends").eq("email", email).eq("site_host", host).is("verified_at", null)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      let leadId: string;
      if (open) {
        const { error } = await db.from("audit_leads")
          .update({ ...patch, sends: (Number(open.sends) || 0) + 1 }).eq("id", open.id);
        if (error) throw new Error(`Zapis zgłoszenia: ${error.message}`);
        leadId = String(open.id);
      } else {
        const { data, error } = await db.from("audit_leads")
          .insert({ ...patch, sends: 1, status: "new" }).select("id").single();
        if (error) throw new Error(`Zapis zgłoszenia: ${error.message}`);
        leadId = String(data.id);
      }

      const m = mailCode(code, host);
      const sent = await sendMail(email, m.subject, m.html);
      if (!sent.ok) {
        console.error("kod nie wyszedł:", sent.error);
        return json({ ok: false, reason: "Nie udało się wysłać kodu na ten adres. Sprawdź go albo napisz do nas: infinitiq@fastline.pl" }, 502);
      }
      console.log("kod wysłany", email, host);
      return json({ ok: true, lead_id: leadId, host, site_url: probe.url, ttl_min: CODE_TTL_MIN });
    }

    // ── 3. sprawdź kod → audyt do kolejki ───────────────────────────────────
    if (action === "code.verify") {
      const leadId = String(body.lead_id ?? "");
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (!leadId || code.length !== 4) return json({ ok: false, reason: "Wpisz 4-cyfrowy kod z e-maila" }, 400);

      const { data: lead } = await db.from("audit_leads").select("*").eq("id", leadId).maybeSingle();
      if (!lead) return json({ ok: false, reason: "Nie znamy tego zgłoszenia — zacznij od nowa" }, 404);

      // już potwierdzone: nie generujemy drugiego audytu, oddajemy ten sam link
      if (lead.verified_at && lead.audit_id) {
        const { data: a } = await db.from("audits").select("slug, status").eq("id", lead.audit_id).maybeSingle();
        return json({ ok: true, status: a?.status ?? "queued", slug: a?.slug ?? null, email: lead.email });
      }
      if (!lead.code_hash || !lead.code_expires_at || new Date(String(lead.code_expires_at)).getTime() < Date.now())
        return json({ ok: false, reason: "Kod stracił ważność — zamów nowy", expired: true }, 400);
      if ((Number(lead.code_attempts) || 0) >= MAX_CODE_TRIES)
        return json({ ok: false, reason: "Za dużo prób. Zamów nowy kod", expired: true }, 429);

      if (await codeHash(code, String(lead.email)) !== lead.code_hash) {
        const tries = (Number(lead.code_attempts) || 0) + 1;
        await db.from("audit_leads").update({ code_attempts: tries, updated_at: nowIso() }).eq("id", leadId);
        const left = MAX_CODE_TRIES - tries;
        return json({ ok: false, reason: left > 0 ? `Kod się nie zgadza — zostały ${left} próby` : "Za dużo prób. Zamów nowy kod", expired: left <= 0 }, 400);
      }

      // kod poprawny — czy mamy już świeży audyt tej domeny?
      const { data: existing } = await db.from("audits")
        .select("id, slug, status, generated_at")
        .eq("status", "ready").ilike("site_url", `%${lead.site_host}%`)
        .gte("generated_at", new Date(Date.now() - REUSE_AUDIT_DAYS * 86400_000).toISOString())
        .order("generated_at", { ascending: false }).limit(1).maybeSingle();

      let auditId: string, slug: string, status: string;
      if (existing) {
        auditId = String(existing.id); slug = String(existing.slug); status = "ready";
      } else {
        slug = await freeSlug(db, String(lead.site_host));
        const { data: created, error } = await db.from("audits").insert({
          slug,
          client_name: String(lead.client_name || lead.site_host).slice(0, 120),
          site_url: String(lead.site_url),
          status: "queued",
          source: "landing",
          lead_email: String(lead.email),
          prices: { packages: [{ name: "Podstawowy", price: "" }, { name: "Standard", price: "" }, { name: "Premium", price: "" }], note: "" },
        }).select("id, slug").single();
        if (error) throw new Error(`Utworzenie audytu: ${error.message}`);
        auditId = String(created.id); slug = String(created.slug); status = "queued";
      }

      await db.from("audit_leads").update({
        verified_at: nowIso(), audit_id: auditId, code_hash: null,
        status: status === "ready" ? "verified" : "queued", updated_at: nowIso(),
      }).eq("id", leadId);

      await notifyUs(lead as Record<string, unknown>, slug, !!existing);
      await db.from("audit_leads").update({ notify_mail_at: nowIso() }).eq("id", leadId);

      if (status === "ready") {
        // gotowy raport wysyłamy od razu; `notify` już go nie ruszy
        const m = mailReady(slug, String(lead.site_host));
        const sent = await sendMail(String(lead.email), m.subject, m.html);
        if (sent.ok) await db.from("audit_leads").update({ ready_mail_at: nowIso(), status: "ready" }).eq("id", leadId);
      } else {
        await kickQueue(supaUrl, anon);
      }
      console.log("lead potwierdzony", lead.email, lead.site_host, "→", slug, status);
      return json({ ok: true, status, slug, email: lead.email });
    }

    // ── status dla strony (pasek postępu) ───────────────────────────────────
    if (action === "status") {
      const leadId = String(body.lead_id ?? "");
      const { data: lead } = await db.from("audit_leads").select("audit_id, status, ready_mail_at").eq("id", leadId).maybeSingle();
      if (!lead) return json({ ok: false }, 404);
      let auditStatus = "queued", slug: string | null = null;
      if (lead.audit_id) {
        const { data: a } = await db.from("audits").select("slug, status").eq("id", lead.audit_id).maybeSingle();
        if (a) { auditStatus = String(a.status); slug = String(a.slug); }
      }
      return json({ ok: true, status: auditStatus, slug, mailed: !!lead.ready_mail_at });
    }

    // ── pg_cron: roześlij gotowe raporty ────────────────────────────────────
    if (action === "notify") {
      if (!CRON_KEY || body.cron_key !== CRON_KEY) return json({ error: "forbidden" }, 403);
      const { data: waiting } = await db.from("audit_leads")
        .select("id, email, site_host, audit_id")
        .not("audit_id", "is", null).is("ready_mail_at", null).is("fail_mail_at", null)
        .limit(20);
      let ready = 0, failed = 0;
      for (const l of waiting ?? []) {
        const { data: a } = await db.from("audits").select("slug, status").eq("id", l.audit_id).maybeSingle();
        if (!a) continue;
        if (a.status === "ready") {
          const m = mailReady(String(a.slug), String(l.site_host));
          const sent = await sendMail(String(l.email), m.subject, m.html);
          if (sent.ok) { await db.from("audit_leads").update({ ready_mail_at: nowIso(), status: "ready", updated_at: nowIso() }).eq("id", l.id); ready++; }
          else console.error("raport nie wyszedł:", l.email, sent.error);
        } else if (a.status === "error") {
          const m = mailFail(String(l.site_host));
          const sent = await sendMail(String(l.email), m.subject, m.html);
          if (sent.ok) { await db.from("audit_leads").update({ fail_mail_at: nowIso(), status: "error", updated_at: nowIso() }).eq("id", l.id); failed++; }
          if (NOTIFY_TO) await sendMail(NOTIFY_TO, `Audyt z lendingu padł: ${l.site_host}`,
            shell(`<tr><td style="padding:26px 30px 24px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:rgba(245,245,240,0.9);">
              Audyt <strong style="color:#F5F5F0;">${esc(String(l.site_host))}</strong> (${esc(String(l.email))}) skończył się błędem.
              Klient dostał wiadomość, że zajmiemy się tym ręcznie w 24 h.</p></td></tr>`, `Błąd audytu ${l.site_host}`));
        }
      }
      return json({ ok: true, ready, failed });
    }

    return json({ error: "Nieznana akcja" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("audyt-lead:", msg);
    return json({ ok: false, reason: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę." }, 500);
  }
});
