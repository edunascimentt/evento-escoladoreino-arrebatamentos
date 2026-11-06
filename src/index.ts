// Worker for the free live class sign-up page ("Todos os arrebatamentos da Bíblia").
//
// Writes into the SAME D1 database as the main site (escoladoreino-club, schema owned by
// ../escoladoreinoclub/migrations): every sign-up becomes a row in `leads` (status
// "cadastrou") plus an `aula_inscricao` event, so it shows up in escoladoreino.com/admin
// next to the other leads. This Worker never creates or alters tables.
//
//   POST /api/inscricao        sign-up form (JSON) -> leads + events, sets "ins" cookie
//   GET  /api/grupo            { ready } — whether the WhatsApp group link is set
//   GET  /entrar               302 to the WhatsApp group (records an `aula_grupo` event)
//   POST /api/pv               PageView for the Conversions API (browser sends the same eventId)
//   GET  /admin/inscritos.csv  this class's sign-ups as CSV, HTTP Basic auth (ADMIN_PASSWORD)
// Everything else is a static file from ./public.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  FORM_LIMITER: RateLimit;
  WHATSAPP_GROUP_URL: string;
  AULA_SLUG: string;
  AULA_NOME: string;
  ADMIN_PASSWORD?: string;
  META_PIXEL_ID: string;
  META_GRAPH_VERSION: string;
  META_CAPI_TOKEN?: string; // secret; without it only the browser Pixel runs
  META_TEST_EVENT_CODE?: string; // optional secret, to see server events in Events Manager → Test events
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const GROUP_RE = /^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//;
const ID_RE = /^[0-9a-f-]{36}$/;
// Same channel rules as escoladoreinoclub/src/lib/attribution.ts.
const META_SOURCES = /^(facebook|fb|instagram|ig|meta|an|messenger)$/i;
const PAID_MEDIUMS = /^(cpc|ppc|paid|paid_social|ads?|cpm|paidsocial)$/i;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s ? s.slice(0, max) : null;
};

const now = () => Math.floor(Date.now() / 1000);

function cookie(req: Request, name: string): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function groupUrl(env: Env): string | null {
  const u = (env.WHATSAPP_GROUP_URL ?? '').trim();
  return GROUP_RE.test(u) ? u : null;
}

function channelOf(p: { src: string | null; med: string | null; fbclid: string | null; referrer: string | null; host: string }): string {
  const src = p.src ?? '';
  const med = p.med ?? '';
  if (META_SOURCES.test(src)) return PAID_MEDIUMS.test(med) || p.fbclid ? 'meta_ads' : 'social';
  if (p.fbclid) return 'meta_ads';
  if (/^qr/i.test(src) || /^qr/i.test(med)) return 'qr';
  if (/whats/i.test(src)) return 'whatsapp';
  if (/e-?mail|newsletter/i.test(src + med)) return 'email';
  if (src) return 'link';
  if (p.referrer) {
    try {
      const ref = new URL(p.referrer).hostname;
      if (ref && ref !== p.host) {
        if (/(facebook|instagram|fb|t\.co|twitter|x\.com|tiktok|youtube|linkedin)\./i.test(ref)) return 'social';
        if (/whatsapp/i.test(ref)) return 'whatsapp';
        return 'referencia';
      }
    } catch { /* bad referrer */ }
  }
  return 'direto';
}

const device = (ua: string) => (/ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop');


// ───────── Meta Conversions API ─────────
// Server twin of the browser Pixel (public/assets/pixel.js). Both send the same event_id,
// so Meta deduplicates. Same approach as escoladoreinoclub/src/lib/meta-capi.ts.
const EVENT_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

async function sha256(v: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const hashed = async (v: string | null | undefined) => (v ? [await sha256(v.trim().toLowerCase())] : undefined);
// Stored phones: Brazilian ones as national digits (DDD + number), foreign ones as "+<code><number>".
const phone55 = (p: string | null | undefined) => {
  const d = (p ?? '').replace(/\D/g, '');
  if (!d) return null;
  if ((p ?? '').trim().startsWith('+')) return d;
  return d.length <= 11 ? `55${d}` : d;
};

// WhatsApp from the form (optional). Returns null when left blank, false when invalid.
// Brazil (no "+", or "+55") keeps the national digits the main site already uses;
// any other country is kept as "+<code><number>" (E.164, 8-15 digits).
function normPhone(raw: unknown): string | null | false {
  const s = String(raw ?? '').trim();
  const d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) {
    if (d.startsWith('55')) {
      const br = d.slice(2);
      return br.length >= 10 && br.length <= 11 ? br : false;
    }
    return d.length >= 8 && d.length <= 15 ? `+${d}` : false;
  }
  return d.length >= 10 && d.length <= 13 ? d : false;
}

interface CapiEvent {
  name: string;
  eventId: string;
  sourceUrl: string;
  req: Request;
  externalId?: string | null;
  email?: string | null;
  phone?: string | null;
  name_?: string | null;
  customData?: Record<string, unknown>;
}

async function sendCapi(env: Env, ev: CapiEvent): Promise<void> {
  if (!env.META_CAPI_TOKEN || !env.META_PIXEL_ID) return;
  if (cookie(ev.req, 'edr_consent') === 'denied') return;
  const cf = (ev.req as unknown as { cf?: Record<string, string> }).cf ?? {};
  const fbclid = new URL(ev.sourceUrl).searchParams.get('fbclid');
  const parts = (ev.name_ ?? '').trim().split(/\s+/);
  const user_data: Record<string, unknown> = {
    client_ip_address: ev.req.headers.get('cf-connecting-ip') ?? undefined,
    client_user_agent: ev.req.headers.get('user-agent') ?? undefined,
    fbp: cookie(ev.req, '_fbp') ?? undefined,
    fbc: cookie(ev.req, '_fbc') ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined),
    external_id: await hashed(ev.externalId),
    em: await hashed(ev.email),
    ph: await hashed(phone55(ev.phone)),
    fn: await hashed(parts[0] || null),
    ln: await hashed(parts.length > 1 ? parts[parts.length - 1] : null),
    ct: await hashed(cf.city?.replace(/\s+/g, '')),
    st: await hashed(cf.regionCode),
    country: await hashed(cf.country),
  };
  const body: Record<string, unknown> = {
    data: [{
      event_name: ev.name,
      event_time: now(),
      event_id: ev.eventId,
      event_source_url: ev.sourceUrl,
      action_source: 'website',
      user_data,
      custom_data: ev.customData,
    }],
  };
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!res.ok) console.error('meta capi error', ev.name, res.status, (await res.text()).slice(0, 400));
  } catch (err) {
    console.error('meta capi fetch failed', ev.name, err);
  }
}

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|whatsapp|telegram|preview|headless|lighthouse|curl|wget|python/i;

async function pageView(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOT_RE.test(ua)) return new Response(null, { status: 204 });
  const { success } = await env.FORM_LIMITER.limit({ key: `pv:${req.headers.get('cf-connecting-ip') ?? ''}` });
  if (!success) return new Response(null, { status: 204 });
  const body = await req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const eventId = typeof body.eventId === 'string' && EVENT_ID_RE.test(body.eventId) ? body.eventId : null;
  let url: string | null = null;
  try {
    const u = new URL(String(body.url));
    if (u.host === new URL(req.url).host) url = u.toString();
  } catch { /* bad url */ }
  if (eventId && url) {
    const id = cookie(req, 'ins');
    ctx.waitUntil(sendCapi(env, { name: 'PageView', eventId, sourceUrl: url, req, externalId: id && ID_RE.test(id) ? id : null }));
  }
  return new Response(null, { status: 204 });
}

async function signup(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  const { success } = await env.FORM_LIMITER.limit({ key: ip });
  if (!success) return json({ ok: false, error: 'rate' }, 429);

  const body = await req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  // Bots: honeypot filled or form sent faster than a person could type.
  if (body.website || Number(body.elapsed) < 1500) return json({ ok: true });

  const name = clip(body.name, 120);
  const email = clip(body.email, 200)?.toLowerCase() ?? null;
  const phone = normPhone(body.phone);
  if (!name || name.length < 2) return json({ ok: false, error: 'name' }, 400);
  if (phone === false) return json({ ok: false, error: 'phone' }, 400);
  if (!email || !EMAIL_RE.test(email)) return json({ ok: false, error: 'email' }, 400);
  if (body.agree !== true) return json({ ok: false, error: 'agree' }, 400);

  const utm = (body.utm ?? {}) as Record<string, unknown>;
  const u = (k: string) => clip(utm[k], 200);
  const referrer = clip(body.referrer, 500);
  const ua = req.headers.get('user-agent') ?? '';
  const cf = (req as unknown as { cf?: Record<string, string> }).cf ?? {};
  const consent = cookie(req, 'edr_consent') === 'denied' ? 0 : 1;
  const t = now();

  // Same person (WhatsApp or e-mail) already in the site's leads: update that lead
  // instead of creating a duplicate.
  const found = await env.DB.prepare(
    'SELECT id FROM leads WHERE phone = ? OR email = ? ORDER BY (phone = ?) DESC, last_seen DESC LIMIT 1',
  )
    .bind(phone, email, phone)
    .first<{ id: string }>();
  const id = found?.id ?? crypto.randomUUID();

  const write = found
    ? env.DB.prepare(
        `UPDATE leads SET name = ?, phone = COALESCE(phone, ?), email = COALESCE(email, ?), last_seen = ?,
           status = CASE WHEN status = 'visitou' THEN 'cadastrou' ELSE status END WHERE id = ?`,
      ).bind(name, phone, email, t, id)
    : env.DB.prepare(
        `INSERT INTO leads (id, channel, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid,
           referrer, landing_path, country, region, city, device, name, email, phone, status, notes, consent,
           first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cadastrou', ?, ?, ?, ?)`,
      ).bind(
        id,
        channelOf({ src: u('utm_source'), med: u('utm_medium'), fbclid: u('fbclid'), referrer, host: new URL(req.url).hostname }),
        u('utm_source'), u('utm_medium'), u('utm_campaign'), u('utm_content'), u('utm_term'), u('fbclid'),
        referrer, `/${env.AULA_SLUG}`,
        cf.country ?? null, cf.region ?? null, cf.city ?? null, device(ua),
        name, email, phone,
        `Inscrito na aula: ${env.AULA_NOME}`,
        consent, t, t,
      );

  // One sign-up event per lead and class (re-submitting doesn't add another).
  const event = env.DB.prepare(
    `INSERT INTO events (lead_id, type, data, created_at)
     SELECT ?1, 'aula_inscricao', ?2, ?3
     WHERE NOT EXISTS (SELECT 1 FROM events WHERE lead_id = ?1 AND type = 'aula_inscricao' AND json_extract(data, '$.aula') = ?4)`,
  ).bind(
    id,
    JSON.stringify({ aula: env.AULA_SLUG, nome: env.AULA_NOME, utm_source: u('utm_source'), utm_campaign: u('utm_campaign') }),
    t,
    env.AULA_SLUG,
  );

  await env.DB.batch([write, event]);

  const eventId = typeof body.eventId === 'string' && EVENT_ID_RE.test(body.eventId) ? body.eventId : null;
  if (eventId) {
    const page = new URL('/', req.url);
    const utmQs = new URLSearchParams();
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid']) { const v = u(k); if (v) utmQs.set(k, v); }
    page.search = utmQs.toString();
    ctx.waitUntil(sendCapi(env, {
      name: 'Lead', eventId, sourceUrl: page.toString(), req, externalId: id, email, phone, name_: name,
      customData: { content_name: 'Aula: Todos os arrebatamentos da Bíblia', content_category: 'aula_gratuita' },
    }));
  }

  const res = json({ ok: true });
  res.headers.append('set-cookie', `ins=${id}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return res;
}

async function enter(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = groupUrl(env);
  if (!url) return Response.redirect(new URL('/grupo', req.url).toString(), 302);
  const id = cookie(req, 'ins');
  const eid = new URL(req.url).searchParams.get('eid');
  if (eid && EVENT_ID_RE.test(eid)) {
    const lead = id && ID_RE.test(id)
      ? await env.DB.prepare('SELECT name, email, phone FROM leads WHERE id = ?').bind(id).first<{ name: string | null; email: string | null; phone: string | null }>()
      : null;
    ctx.waitUntil(sendCapi(env, {
      name: 'CompleteRegistration', eventId: eid, sourceUrl: new URL('/grupo', req.url).toString(), req,
      externalId: lead ? id : null, email: lead?.email, phone: lead?.phone, name_: lead?.name,
      customData: { content_name: 'Grupo WhatsApp: Todos os arrebatamentos da Bíblia', status: 'grupo' },
    }));
  }
  if (id && ID_RE.test(id)) {
    ctx.waitUntil(
      env.DB.prepare(
        `INSERT INTO events (lead_id, type, data, created_at)
         SELECT ?1, 'aula_grupo', ?2, ?3
         WHERE EXISTS (SELECT 1 FROM leads WHERE id = ?1)
           AND NOT EXISTS (SELECT 1 FROM events WHERE lead_id = ?1 AND type = 'aula_grupo' AND json_extract(data, '$.aula') = ?4)`,
      )
        .bind(id, JSON.stringify({ aula: env.AULA_SLUG }), now(), env.AULA_SLUG)
        .run(),
    );
  }
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store' } });
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

async function exportCsv(req: Request, env: Env): Promise<Response> {
  const pass = env.ADMIN_PASSWORD ?? '';
  const auth = req.headers.get('authorization') ?? '';
  let given = '';
  try {
    given = auth.startsWith('Basic ') ? atob(auth.slice(6)).split(':').slice(1).join(':') : '';
  } catch { /* malformed header */ }
  if (!pass || !safeEqual(given, pass)) {
    return new Response('Acesso restrito', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="Inscritos", charset="UTF-8"' },
    });
  }
  const { results } = await env.DB.prepare(
    `SELECT l.name, l.phone, l.email, datetime(e.created_at, 'unixepoch', '-3 hours') AS inscrito_em,
       CASE WHEN g.id IS NULL THEN '' ELSE 'sim' END AS clicou_grupo,
       l.channel, l.utm_source, l.utm_medium, l.utm_campaign, l.utm_content, l.city, l.region
     FROM events e
     JOIN leads l ON l.id = e.lead_id
     LEFT JOIN events g ON g.lead_id = e.lead_id AND g.type = 'aula_grupo' AND json_extract(g.data, '$.aula') = ?1
     WHERE e.type = 'aula_inscricao' AND json_extract(e.data, '$.aula') = ?1
     ORDER BY e.created_at`,
  )
    .bind(env.AULA_SLUG)
    .all<Record<string, unknown>>();
  const cols = ['name', 'phone', 'email', 'inscrito_em', 'clicou_grupo', 'channel', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'city', 'region'];
  const head = ['nome', 'whatsapp', 'email', 'inscrito_em', 'clicou_grupo', 'canal', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'cidade', 'estado'];
  const esc = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // no formula injection when opened in Excel/Sheets
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [head.join(';'), ...results.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="inscritos-${env.AULA_SLUG}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === '/api/inscricao' && req.method === 'POST') return signup(req, env, ctx);
    if (pathname === '/api/pv' && req.method === 'POST') return pageView(req, env, ctx);
    if (pathname === '/api/grupo') return json({ ready: !!groupUrl(env) });
    if (pathname === '/entrar') return enter(req, env, ctx);
    if (pathname === '/admin/inscritos.csv') return exportCsv(req, env);
    return json({ ok: false }, 404);
  },
} satisfies ExportedHandler<Env>;
