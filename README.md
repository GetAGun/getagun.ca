# getagun.ca

Map of personally-verified Canadian firearms retailers, with private
nearest-retailer search (all matching happens in your browser — no tracking),
a fully bilingual EN/FR interface, and a guide to getting your PAL.

Built with React, MapLibre GL (pmtiles basemap), and Cloudflare Workers + D1.

## Features

- Category filters (independents, Canadian Tire, Co-op, FCNQ, and other
  chains), shareable as links via `?categories=` — e.g.
  [getagun.ca/?categories=canadian-tire](https://getagun.ca/?categories=canadian-tire)
- Density view: a per-capita choropleth of gun stores per 100,000 residents
  by 2021 census division, computed live in the browser and responsive to
  the active category filters; click a division for its rate
- Live "stores in view" counter, pin clustering toggle, five basemap themes,
  fullscreen mode
- Published data under `/sheets/`: browsable spreadsheets of
  [all mapped retailers by category](https://getagun.ca/sheets/retailers-by-category)
  and [which Canadian Tires stock firearms](https://getagun.ca/sheets/canadian-tire-stores),
  with .xlsx downloads and charts — all available in French at the same
  address plus `-fr`
- FAQ with rich-text answers and a suggestion form (Turnstile-protected)
- Door-to-door flyer canvassing at `/admin/canvass`: every residential address
  in London, Ontario, a five-point reaction scale, and resident contact details,
  installable to a phone and usable with no signal

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

## Canvassing

`/admin/canvass` is a field tool for handing out PAL/RPAL flyers: pick a street
or pull the streets around you, walk it, and log each door. It sits behind the
same Cloudflare Access app as the rest of `/admin`, and resident names, phone
numbers and emails live only in D1 behind that gate.

The address list is built from two City of London open data layers — 143,124
unit-level address points joined to 6,773 zoning polygons, so each door carries
its land use and the list can default to residential. Rebuild it with
`canvass-prep.py`, which writes `public/canvass/` (gitignored, ~15 MB).

Add the table before deploying the code. Run both from the repo root, so
wrangler picks up `wrangler.jsonc` and targets the right database:

    npx wrangler d1 execute getagun --local  --file=schema.sql
    npx wrangler d1 execute getagun --remote --file=../getagun-tools/canvass-migration.sql

`--file` is resolved against the working directory, not the config, so run these
from the repo or pass an absolute path.

Notes:

- Doors are written to the phone first and queued, so nothing is lost in a dead
  zone; the queue flushes on reconnect. Writes are last-write-wins on a
  timestamp, so a door queued offline cannot overwrite a newer edit made
  elsewhere.
- `public/admin/canvass/sw.js` is scoped to `/admin/canvass/` and never touches
  the public site. It has no precache list, so offline works from the second
  visit onward, and the first load after a deploy still serves the previous
  build before updating.
- The basemap is fetched as byte ranges and is not cached: the list, every
  street and all logging work offline, but the map needs signal.

Requires: D1 database `getagun` (schema.sql applied --remote), Turnstile
site + `TURNSTILE_SECRET` secret, a Cloudflare Access app covering
getagun.ca/admin and getagun.ca/api/admin with ACCESS_TEAM_DOMAIN and
ACCESS_AUD vars set, an R2 bucket bound as `TILES` containing
`canada.pmtiles`, and a `www.getagun.ca` → apex redirect rule in the zone.

## Data sources

Basemap © [OpenStreetMap](https://openstreetmap.org/copyright) contributors,
served as a self-hosted pmtiles extract. Census division boundaries and
populations for the density view are adapted from Statistics Canada's 2021
Census (Boundary Files and Population and Dwelling Counts), used under the
[Statistics Canada Open Licence](https://www.statcan.gc.ca/en/reference/licence).
Retailer data is my own verification work.
