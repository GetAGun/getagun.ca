# getagun.ca

Map of personally-verified Canadian firearms retailers, with private
nearest-retailer search (all matching happens in your browser — no tracking),
an EN/FR interface, and a guide to getting your PAL.

Built with React, MapLibre GL (pmtiles basemap), and Cloudflare Workers + D1.

## Development

    npm install
    cp .env.example .env       # defaults work for dev
    npx wrangler d1 execute getagun --local --file=schema.sql
    npx wrangler dev           # API on :8787
    npm run dev                # site on :5173, /api proxied

`.dev.vars` needs `TURNSTILE_SECRET` (Cloudflare's always-pass test secret
`1x0000000000000000000000000000000AA`) and `DEV_SKIP_ACCESS=1` to bypass
Cloudflare Access locally — Access verification otherwise fails closed.

## Deploy

    npm run deploy

Requires: D1 database `getagun` (schema.sql applied --remote), Turnstile
site + `TURNSTILE_SECRET` secret, a Cloudflare Access app covering
getagun.ca/admin and getagun.ca/api/admin with ACCESS_TEAM_DOMAIN and
ACCESS_AUD vars set, an R2 bucket bound as `TILES` containing
`canada.pmtiles`, and a `www.getagun.ca` → apex redirect rule in the zone.
