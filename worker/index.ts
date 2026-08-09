import { validateSuggestion, validateRetailer, validateFaq } from './validate';
import { requireAccess } from './access';
import { purgeSheets, sheetsRoute } from './sheets';

export interface Env {
  DB: D1Database;
  TILES: R2Bucket;
  ASSETS: Fetcher;
  TURNSTILE_SECRET: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  DEV_SKIP_ACCESS?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const cacheKeyFor = (url: URL) => new Request(`${url.origin}/api/retailers`);
const faqCacheKeyFor = (url: URL) => new Request(`${url.origin}/api/faqs`);

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip ?? undefined }),
    });
    if (!r.ok) return false;
    return ((await r.json()) as { success: boolean }).success;
  } catch {
    return false;
  }
}

const TILE_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD',
  'access-control-allow-headers': 'range, if-match',
  'access-control-expose-headers': 'etag, content-length, content-range, accept-ranges',
};

async function handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;

  // Basemap served from R2 through the worker; pmtiles readers fetch byte ranges.
  if (pathname === '/tiles/canada.pmtiles') {
    if (request.method === 'OPTIONS') return new Response(null, { headers: TILE_CORS });
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'not found' }, 404);
    const m = request.headers.get('range')?.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const offset = Number(m[1]);
      const length = m[2] !== undefined ? Number(m[2]) - offset + 1 : undefined;
      const obj = await env.TILES.get('canada.pmtiles', { range: length === undefined ? { offset } : { offset, length } });
      if (!obj) return json({ error: 'not found' }, 404);
      const len = length ?? obj.size - offset;
      return new Response(obj.body, {
        status: 206,
        headers: {
          ...TILE_CORS,
          'content-type': 'application/octet-stream',
          'content-length': String(len),
          'content-range': `bytes ${offset}-${offset + len - 1}/${obj.size}`,
          'accept-ranges': 'bytes',
          etag: obj.httpEtag,
          'cache-control': 'public, max-age=86400, immutable',
        },
      });
    }
    const obj = await env.TILES.get('canada.pmtiles');
    if (!obj) return json({ error: 'not found' }, 404);
    return new Response(obj.body, {
      headers: {
        ...TILE_CORS,
        'content-type': 'application/octet-stream',
        'content-length': String(obj.size),
        'accept-ranges': 'bytes',
        etag: obj.httpEtag,
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  }

  if (pathname === '/api/retailers' && request.method === 'GET') {
    const key = cacheKeyFor(url);
    const cached = await caches.default.match(key);
    if (cached) return cached;
    const { results } = await env.DB.prepare(
      'SELECT id, name, address, city, province, postal, lat, lon, phone, website, description, category FROM retailers ORDER BY name',
    ).all();
    const res = json(results);
    res.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
    ctx.waitUntil(caches.default.put(key, res.clone()));
    return res;
  }

  if (pathname === '/api/faqs' && request.method === 'GET') {
    const key = faqCacheKeyFor(url);
    const cached = await caches.default.match(key);
    if (cached) return cached;
    const { results } = await env.DB.prepare(
      'SELECT id, question_en, answer_en, question_fr, answer_fr, position FROM faqs ORDER BY position, id',
    ).all();
    const res = json(results);
    res.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
    ctx.waitUntil(caches.default.put(key, res.clone()));
    return res;
  }

  // Dynamic sheets and live charts; anything else under /sheets/ (the PNGs)
  // falls through to the static assets.
  if (pathname.startsWith('/sheets/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const r = await sheetsRoute(request, env, ctx);
    return r ?? env.ASSETS.fetch(request);
  }

  if (pathname === '/api/suggest' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    const v = validateSuggestion(body);
    if (!v.ok) return json({ error: v.error }, 400);
    const token = (body as Record<string, unknown>).turnstileToken;
    const ip = request.headers.get('cf-connecting-ip');
    if (typeof token !== 'string' || !(await verifyTurnstile(token, env.TURNSTILE_SECRET, ip))) {
      return json({ error: 'turnstile' }, 403);
    }
    const s = v.value;
    await env.DB.prepare(
      'INSERT INTO suggestions (name, address, city, province, website, note, kind) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).bind(s.name, s.address, s.city, s.province, s.website, s.note, s.kind).run();
    return json({ ok: true }, 201);
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!(await requireAccess(request, env))) return json({ error: 'unauthorized' }, 401);
    // cache.delete clears this colo only; the 5-min TTL covers other colos
    const purge = () => {
      ctx.waitUntil(caches.default.delete(cacheKeyFor(url)));
      purgeSheets(url.origin, ctx);
    };

    if (pathname === '/api/admin/refresh-sheets' && request.method === 'POST') {
      purge();
      return json({ ok: true });
    }

    if (pathname === '/api/admin/retailers' && request.method === 'POST') {
      const v = validateRetailer(await request.json().catch(() => null));
      if (!v.ok) return json({ error: v.error }, 400);
      const r = v.value;
      const { meta } = await env.DB.prepare(
        `INSERT INTO retailers (name, address, city, province, postal, lat, lon, phone, website, description, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(r.name, r.address, r.city, r.province, r.postal, r.lat, r.lon, r.phone, r.website, r.description, r.category).run();
      purge();
      return json({ id: meta.last_row_id }, 201);
    }

    const rMatch = pathname.match(/^\/api\/admin\/retailers\/(\d+)$/);
    if (rMatch && request.method === 'PUT') {
      const v = validateRetailer(await request.json().catch(() => null));
      if (!v.ok) return json({ error: v.error }, 400);
      const r = v.value;
      await env.DB.prepare(
        `UPDATE retailers SET name=?, address=?, city=?, province=?, postal=?, lat=?, lon=?, phone=?, website=?, description=?, category=?, updated_at=datetime('now') WHERE id=?`,
      ).bind(r.name, r.address, r.city, r.province, r.postal, r.lat, r.lon, r.phone, r.website, r.description, r.category, Number(rMatch[1])).run();
      purge();
      return json({ ok: true });
    }
    if (rMatch && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM retailers WHERE id=?').bind(Number(rMatch[1])).run();
      purge();
      return json({ ok: true });
    }

    if (pathname === '/api/admin/resolve-gmaps' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { url?: string } | null;
      let u: URL | null = null;
      try { u = new URL(body?.url ?? ''); } catch { /* invalid */ }
      const GMAPS_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'www.google.com', 'google.com'];
      if (!u || u.protocol !== 'https:' || !GMAPS_HOSTS.includes(u.hostname)) {
        return json({ error: 'not a Google Maps link' }, 400);
      }
      const r = await fetch(u.toString(), {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0' },
      });
      ctx.waitUntil(r.body?.cancel() ?? Promise.resolve()); // only the final URL matters
      const final = new URL(r.url);
      if (!/(^|\.)google\.(com|ca)$/.test(final.hostname)) {
        return json({ error: 'did not resolve to Google Maps' }, 400);
      }
      const placeM = final.pathname.match(/\/place\/([^/]+)/);
      const name = placeM ? decodeURIComponent(placeM[1].replace(/\+/g, ' ')) : null;
      const coordM = r.url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? r.url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      return json({
        name,
        lat: coordM ? Number(coordM[1]) : null,
        lon: coordM ? Number(coordM[2]) : null,
      });
    }

    const purgeFaqs = () => ctx.waitUntil(caches.default.delete(faqCacheKeyFor(url)));
    if (pathname === '/api/admin/faqs' && request.method === 'POST') {
      const v = validateFaq(await request.json().catch(() => null));
      if (!v.ok) return json({ error: v.error }, 400);
      const f = v.value;
      const { meta } = await env.DB.prepare(
        'INSERT INTO faqs (question_en, answer_en, question_fr, answer_fr, position) VALUES (?, ?, ?, ?, ?)',
      ).bind(f.question_en, f.answer_en, f.question_fr, f.answer_fr, f.position).run();
      purgeFaqs();
      return json({ id: meta.last_row_id }, 201);
    }
    const fMatch = pathname.match(/^\/api\/admin\/faqs\/(\d+)$/);
    if (fMatch && request.method === 'PUT') {
      const v = validateFaq(await request.json().catch(() => null));
      if (!v.ok) return json({ error: v.error }, 400);
      const f = v.value;
      await env.DB.prepare(
        "UPDATE faqs SET question_en=?, answer_en=?, question_fr=?, answer_fr=?, position=?, updated_at=datetime('now') WHERE id=?",
      ).bind(f.question_en, f.answer_en, f.question_fr, f.answer_fr, f.position, Number(fMatch[1])).run();
      purgeFaqs();
      return json({ ok: true });
    }
    if (fMatch && request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM faqs WHERE id=?').bind(Number(fMatch[1])).run();
      purgeFaqs();
      return json({ ok: true });
    }

    if (pathname === '/api/admin/suggestions' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        "SELECT * FROM suggestions WHERE status='pending' ORDER BY created_at",
      ).all();
      return json(results);
    }
    const sMatch = pathname.match(/^\/api\/admin\/suggestions\/(\d+)$/);
    if (sMatch && request.method === 'PUT') {
      const body = (await request.json().catch(() => null)) as { status?: string } | null;
      if (!body || body.status === undefined || !['approved', 'rejected'].includes(body.status)) {
        return json({ error: "status must be 'approved' or 'rejected'" }, 400);
      }
      await env.DB.prepare('UPDATE suggestions SET status=? WHERE id=?')
        .bind(body.status, Number(sMatch[1])).run();
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    try {
      return await handle(request, env, ctx);
    } catch {
      return json({ error: 'internal' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
