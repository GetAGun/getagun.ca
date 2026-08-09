// Dynamic /sheets/ content generated from D1: browsable spreadsheets (HTML),
// .xlsx downloads, and live SVG charts served at image URLs. Responses are
// edge-cached and purged when retailer data changes.
import { strToU8, zipSync } from 'fflate';

export interface SheetsEnv {
  DB: D1Database;
}

interface Store {
  name: string; address: string; city: string; province: string; postal: string | null;
  phone: string | null; website: string | null; lat: number; lon: number; category: string;
}
interface CtLocation {
  store_number: number; branch: string; address: string; city: string; province: string;
  postal: string | null; phone: string | null; lat: number; lon: number; website: string | null;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- data ----------

async function retailers(env: SheetsEnv): Promise<Store[]> {
  const { results } = await env.DB.prepare(
    'SELECT name, address, city, province, postal, phone, website, lat, lon, category FROM retailers',
  ).all<Store>();
  return results;
}

async function ctLocations(env: SheetsEnv): Promise<CtLocation[]> {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM ct_locations ORDER BY store_number').all<CtLocation>();
    return results;
  } catch {
    return []; // table not migrated yet
  }
}

// Each mapped Canadian Tire claims only its nearest location (two CT stores can
// sit ~300 m apart), so "sells firearms" = claimed by a mapped store.
function deriveCt(locations: CtLocation[], stores: Store[]): Array<CtLocation & { firearms: 'yes' | 'no' }> {
  const claimed = new Set<number>();
  for (const s of stores) {
    if (s.category !== 'canadian-tire') continue;
    let best: CtLocation | null = null;
    let bd = Infinity;
    for (const l of locations) {
      const dlat = Math.abs(l.lat - s.lat);
      const dlon = Math.abs(l.lon - s.lon);
      if (dlat < 0.005 && dlon < 0.008 && dlat + dlon < bd) {
        best = l;
        bd = dlat + dlon;
      }
    }
    if (best) claimed.add(best.store_number);
  }
  return locations.map((l) => ({ ...l, firearms: claimed.has(l.store_number) ? 'yes' : 'no' }));
}

// ---------- sheet HTML ----------

const UI = {
  en: { dl: 'Download (.xlsx)', rows: 'rows', y: 'stocks firearms', n: 'does not', u: 'unknown', link: 'link', alt: 'Français' },
  fr: { dl: 'Télécharger (.xlsx)', rows: 'lignes', y: 'vend des armes à feu', n: "n'en vend pas", u: 'inconnu', link: 'lien', alt: 'English' },
};

const CT_HEADERS = {
  en: ['store_number', 'branch', 'address', 'city', 'province', 'postal_code', 'phone', 'latitude', 'longitude', 'website', 'firearms'],
  fr: ['nº de magasin', 'succursale', 'adresse', 'ville', 'province', 'code postal', 'téléphone', 'latitude', 'longitude', 'site web', 'armes à feu'],
};
const RBC_HEADERS = {
  en: ['name', 'address', 'city', 'province', 'postal', 'phone', 'website', 'lat', 'lon'],
  fr: ['nom', 'adresse', 'ville', 'province', 'code postal', 'téléphone', 'site web', 'lat', 'lon'],
};
const BANNER_FR: Record<string, string> = {
  INDEPENDENT: 'INDÉPENDANTS', 'CANADIAN TIRE': 'CANADIAN TIRE', PRONATURE: 'PRONATURE',
  ECOTONE: 'ÉCOTONE', 'HOME HARDWARE': 'HOME HARDWARE', 'BASS PRO CABELAS': "BASS PRO / CABELA'S",
  SAIL: 'SAIL', LATULIPPE: 'LATULIPPE', COOP: 'CO-OP', FCNQ: 'FCNQ', GUNSMITH: 'ARMURIERS',
};

type Row = { cells: Array<string | number | null>; banner?: string; cls?: string };

function sheetHtml(title: string, lang: 'en' | 'fr', headers: string[], rows: Row[], alt: string, xlsxHref: string, hasLegend: boolean): string {
  const ui = UI[lang];
  const nrows = rows.filter((r) => !r.banner).length;
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    if (s.startsWith('http://') || s.startsWith('https://')) {
      return `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${ui.link}</a>`;
    }
    return esc(s);
  };
  const tr = (r: Row) =>
    r.banner !== undefined
      ? `<tr class="s"><td colspan="${headers.length}">${esc(r.banner)}</td></tr>`
      : `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.cells.map((v) => `<td>${cell(v)}</td>`).join('')}</tr>`;
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>${esc(title)}</title>` +
    '<link rel="icon" href="/favicon.ico">' +
    '<style>' +
    'body{margin:0;font-family:system-ui,sans-serif;color:#1e293b}' +
    'header{display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;padding:1rem 1.25rem;background:#0f172a;color:#fff}' +
    'header h1{margin:0;font-size:1.1rem}' +
    'header a{color:#93c5fd;font-size:.85rem;text-decoration:none}' +
    'header a:hover{text-decoration:underline}' +
    '.wrap{overflow-x:auto}' +
    'table{border-collapse:collapse;font-size:.85rem;min-width:100%}' +
    'th{position:sticky;top:0;background:#c8181d;color:#fff;text-align:left;padding:.45rem .6rem;white-space:nowrap}' +
    'td{padding:.4rem .6rem;border-bottom:1px solid #e2e8f0;white-space:nowrap}' +
    'tbody tr:nth-child(even){background:#f8fafc}' +
    'tbody tr.y{background:#dcfce7}' +
    'tbody tr.n{background:#fee2e2}' +
    'tbody tr.u{background:#fef9c3}' +
    'tbody tr.s td{background:#e2e8f0;font-weight:600}' +
    '.chip{padding:.15rem .5rem;border-radius:9999px;color:#1e293b;font-size:.75rem}' +
    'td a{color:#2563eb}' +
    '</style></head><body>' +
    `<header><h1>${esc(title)}</h1>` +
    '<a href="/">&larr; getagun.ca</a>' +
    `<a href="${esc(xlsxHref)}" download>${ui.dl}</a>` +
    `<a href="${esc(alt)}">${ui.alt}</a>` +
    `<span style="font-size:.8rem;color:#94a3b8">${nrows} ${ui.rows}</span>` +
    (hasLegend
      ? `<span class="chip" style="background:#dcfce7">${ui.y}</span>` +
        `<span class="chip" style="background:#fee2e2">${ui.n}</span>` +
        `<span class="chip" style="background:#fef9c3">${ui.u}</span>`
      : '') +
    '</header><div class="wrap"><table><thead><tr>' +
    headers.map((h) => `<th>${esc(h)}</th>`).join('') +
    '</tr></thead><tbody>' +
    rows.map(tr).join('') +
    '</tbody></table></div></body></html>'
  );
}

function rbcRows(stores: Store[], lang: 'en' | 'fr'): Row[] {
  const counts = new Map<string, number>();
  for (const s of stores) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const rows: Row[] = [];
  for (const [cat, n] of cats) {
    let label = cat.toUpperCase().replace(/-/g, ' ');
    if (lang === 'fr') label = BANNER_FR[label] ?? label;
    rows.push({ cells: [], banner: `${label} (${n})` });
    const members = stores
      .filter((s) => s.category === cat)
      .sort((a, b) => a.province.localeCompare(b.province) || a.city.toLowerCase().localeCompare(b.city.toLowerCase()) || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    for (const s of members) {
      rows.push({ cells: [s.name, s.address, s.city, s.province, s.postal, s.phone, s.website, s.lat, s.lon] });
    }
  }
  return rows;
}

function ctSheetRows(rows: Array<CtLocation & { firearms: string }>, lang: 'en' | 'fr'): Row[] {
  const val = (f: string) => (lang === 'fr' ? (f === 'yes' ? 'oui' : 'non') : f);
  return rows.map((l) => ({
    cells: [l.store_number, l.branch, l.address, l.city, l.province, l.postal, l.phone, l.lat, l.lon, l.website, val(l.firearms)],
    cls: l.firearms === 'yes' ? 'y' : 'n',
  }));
}

// ---------- xlsx ----------

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const colName = (i: number) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));

export function buildXlsx(sheets: Array<{ name: string; rows: Array<{ cells: Array<string | number | null>; style?: number }> }>): Uint8Array {
  const sheetXml = (rows: Array<{ cells: Array<string | number | null>; style?: number }>) => {
    const body = rows
      .map((r, ri) => {
        const cells = r.cells
          .map((v, ci) => {
            if (v === null || v === '') return '';
            const ref = `${colName(ci)}${ri + 1}`;
            const s = r.style ? ` s="${r.style}"` : '';
            if (typeof v === 'number') return `<c r="${ref}"${s}><v>${v}</v></c>`;
            return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
          })
          .join('');
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join('');
    return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
        sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor rgb="FFD9D9D9"/></patternFill></fill></fills>' +
        '<borders count="1"><border/></borders>' +
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellXfs count="3"><xf/><xf fontId="1" applyFont="1"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs>' +
        '</styleSheet>',
    ),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows));
  });
  return zipSync(files, { level: 6 });
}

// ---------- SVG charts ----------

const CH = { BG: '#FCFCFA', TEXT: '#1A1A19', GRAY: '#6B6B66', BLUE: '#5598E7', TBLUE: '#A9C8EF', SEP: '#EAE9E6', BAND: '#F0EFEC' };
const FONT = 'DejaVu Sans, Verdana, sans-serif';

function txt(x: number, y: number, s: string, size: number, opts: { bold?: boolean; fill?: string; end?: boolean; central?: boolean } = {}): string {
  return (
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}"` +
    (opts.bold ? ' font-weight="bold"' : '') +
    ` fill="${opts.fill ?? CH.TEXT}"` +
    (opts.end ? ' text-anchor="end"' : '') +
    (opts.central ? ' dominant-baseline="central"' : '') +
    `>${esc(s)}</text>`
  );
}

export function ctChartSvg(byProv: Array<{ prov: string; yes: number; no: number }>, fr: boolean): string {
  const provs = [...byProv].sort((a, b) => b.yes / (b.yes + b.no) - a.yes / (a.yes + a.no) || b.yes + b.no - (a.yes + a.no));
  const totY = provs.reduce((s, p) => s + p.yes, 0);
  const totN = provs.reduce((s, p) => s + p.no, 0);
  const BAR_X = 868, BAR_MAX = 200, PITCH = 55.45, Y0 = 179.5;
  const parts: string[] = [`<rect width="1218" height="994" fill="${CH.BG}"/>`];
  parts.push(txt(68, 52, fr ? "Canadian Tire : détaillants d'armes à feu par province" : 'Canadian Tire: firearms retailers by province', 24, { bold: true }));
  const heads: Array<[string, number, boolean]> = fr
    ? [['Prov./Terr.', 69, false], ['Oui', 394, true], ['Non', 559, true], ['Total', 747, true], ['% oui', 869, false]]
    : [['Prov/Terr', 69, false], ['Yes', 394, true], ['No', 559, true], ['Total', 747, true], ['Yes-rate', 869, false]];
  for (const [label, x, end] of heads) parts.push(txt(x, 124, label, 15, { bold: true, fill: CH.GRAY, end }));
  parts.push(`<line x1="55" y1="136" x2="1163" y2="136" stroke="${CH.TEXT}" stroke-width="2.5"/>`);
  const row = (yc: number, name: string, y: number, n: number, bold: boolean) => {
    const frac = y / (y + n);
    parts.push(txt(68, yc, name, 17, { bold, central: true }));
    for (const [val, x] of [[y, 394], [n, 559], [y + n, 747]] as Array<[number, number]>) {
      parts.push(txt(x, yc, String(val), 17, { bold, end: true, central: true }));
    }
    const L = frac * BAR_MAX;
    if (L > 0) {
      parts.push(`<line x1="${BAR_X + 7.5}" y1="${yc}" x2="${BAR_X + Math.max(L - 7.5, 7.5)}" y2="${yc}" stroke="${CH.BLUE}" stroke-width="15" stroke-linecap="round"/>`);
    }
    const pct = `${Math.round(frac * 100)}${fr ? ' %' : '%'}`;
    parts.push(txt(BAR_X + L + 17, yc, pct, 17, { bold, central: true }));
  };
  provs.forEach((p, i) => {
    row(Y0 + i * PITCH, p.prov, p.yes, p.no, false);
    if (i < provs.length - 1) {
      const sy = 204.5 + i * PITCH;
      parts.push(`<line x1="55" y1="${sy}" x2="1163" y2="${sy}" stroke="${CH.SEP}" stroke-width="2"/>`);
    }
  });
  const cyc = Y0 + provs.length * PITCH;
  parts.push(`<rect x="55" y="${cyc - 32.5}" width="1108" height="52" fill="${CH.BAND}"/>`);
  row(cyc, 'Canada', totY, totN, true);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1218" height="994" viewBox="0 0 1218 994">${parts.join('')}</svg>`;
}

// population estimates: Statistics Canada, April 1, 2026
const POP: Record<string, number> = {
  NL: 547910, PE: 181715, NS: 1090852, NB: 866497, QC: 9016222, ON: 16103890,
  MB: 1503865, SK: 1266092, AB: 5057077, BC: 5646420, YT: 48493, NT: 45808, NU: 42215,
};
const TERR = ['YT', 'NT', 'NU'];

export function percapitaWideSvg(counts: Record<string, number>, fr: boolean): string {
  const rate: Record<string, number> = {};
  for (const p of Object.keys(POP)) rate[p] = ((counts[p] ?? 0) / POP[p]) * 1e5;
  const provs = Object.keys(POP).filter((p) => !TERR.includes(p)).sort((a, b) => rate[b] - rate[a]);
  const terrs = [...TERR].sort((a, b) => rate[b] - rate[a]);
  const totalStores = Object.values(counts).reduce((s, n) => s + n, 0);
  const totalPop = Object.values(POP).reduce((s, n) => s + n, 0);
  const totalRate = (totalStores / totalPop) * 1e5;
  const BAR_X = 868, BAR_MAX = 1400, PITCH = 55.45, Y0 = 179.5;
  const SCALE = Math.max(...Object.values(rate));
  const fmtPop = (n: number) => (fr ? n.toLocaleString('en-CA').replace(/,/g, ' ') : n.toLocaleString('en-CA'));
  const fmtRate = (n: number) => (fr ? n.toFixed(1).replace('.', ',') : n.toFixed(1));
  const parts: string[] = [`<rect width="2400" height="994" fill="${CH.BG}"/>`];
  parts.push(txt(68, 52, fr ? "Magasins d'armes à feu par 100 000 habitants, par province" : 'Gun stores per 100,000 residents by province', 24, { bold: true }));
  const heads: Array<[string, number, boolean]> = fr
    ? [['Prov./Terr.', 69, false], ['Magasins', 450, true], ['Population', 747, true], ['Par 100 000', 869, false]]
    : [['Prov/Terr', 69, false], ['Stores', 450, true], ['Population', 747, true], ['Per 100k', 869, false]];
  for (const [label, x, end] of heads) parts.push(txt(x, 124, label, 15, { bold: true, fill: CH.GRAY, end }));
  parts.push(`<line x1="55" y1="136" x2="2345" y2="136" stroke="${CH.TEXT}" stroke-width="2.5"/>`);
  const row = (yc: number, label: string, prov: string | null, bold: boolean, color: string) => {
    const n = prov ? counts[prov] ?? 0 : totalStores;
    const pop = prov ? POP[prov] : totalPop;
    const r = prov ? rate[prov] : totalRate;
    parts.push(txt(68, yc, label, 17, { bold, central: true }));
    parts.push(txt(450, yc, String(n), 17, { bold, end: true, central: true }));
    parts.push(txt(747, yc, fmtPop(pop), 17, { bold, end: true, central: true }));
    const L = (r / SCALE) * BAR_MAX;
    const cap = 7.5;
    if (L > 0) {
      if (L < 2 * cap + 1) parts.push(`<circle cx="${BAR_X + cap}" cy="${yc}" r="${cap}" fill="${color}"/>`);
      else parts.push(`<line x1="${BAR_X + cap}" y1="${yc}" x2="${BAR_X + L - cap}" y2="${yc}" stroke="${color}" stroke-width="15" stroke-linecap="round"/>`);
    }
    parts.push(txt(BAR_X + Math.max(L, 2 * cap) + 17, yc, fmtRate(r), 17, { bold, central: true }));
  };
  const all: Array<[string, string, string]> = [
    ...provs.map((p) => [p, p, CH.BLUE] as [string, string, string]),
    ...terrs.map((t) => [`${t}*`, t, CH.TBLUE] as [string, string, string]),
  ];
  all.forEach(([label, prov, color], i) => {
    const yc = Y0 + i * PITCH;
    row(yc, label, prov, false, color);
    const sy = 204.5 + i * PITCH;
    parts.push(`<line x1="55" y1="${sy}" x2="2345" y2="${sy}" stroke="${CH.SEP}" stroke-width="2"/>`);
  });
  const cyc = Y0 + all.length * PITCH;
  parts.push(`<rect x="55" y="${cyc - 26}" width="2290" height="52" fill="${CH.BAND}"/>`);
  row(cyc, 'Canada', null, true, CH.BLUE);
  const note = fr
    ? '* Territoires classés séparément — leurs très faibles populations produisent des taux par habitant extrêmes.'
    : '* Territories ranked separately — very small populations produce extreme per-capita rates.';
  parts.push(txt(68, cyc + 55, note, 13, { fill: CH.GRAY, central: true }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="4800" height="1988" viewBox="0 0 2400 994">${parts.join('')}</svg>`;
}

// ---------- routing ----------

const TITLES = {
  rbc: { en: 'Mapped Firearms Retailers by Category', fr: "Détaillants d'armes à feu cartographiés, par catégorie" },
  ct: { en: 'Canadian Tire Locations That Stock Guns', fr: 'Succursales Canadian Tire qui vendent des armes à feu' },
};

export const DYNAMIC_SHEET_PATHS = [
  '/sheets/retailers-by-category', '/sheets/retailers-by-category-fr',
  '/sheets/canadian-tire-stores', '/sheets/canadian-tire-stores-fr',
  '/sheets/retailers-by-category.xlsx', '/sheets/retailers-by-category-fr.xlsx',
  '/sheets/canadian-tire-stores.xlsx', '/sheets/canadian-tire-stores-fr.xlsx',
  '/sheets/ct-firearms-by-province.svg', '/sheets/ct-firearms-by-province-fr.svg',
  '/sheets/gun-stores-per-capita-wide.svg', '/sheets/gun-stores-per-capita-wide-fr.svg',
];

export function purgeSheets(origin: string, ctx: ExecutionContext): void {
  ctx.waitUntil(Promise.all(DYNAMIC_SHEET_PATHS.map((p) => caches.default.delete(new Request(origin + p)))));
}

export async function sheetsRoute(request: Request, env: SheetsEnv, ctx: ExecutionContext): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.endsWith('.html')) path = path.slice(0, -5);
  if (!DYNAMIC_SHEET_PATHS.includes(path)) return null;

  const key = new Request(url.origin + path);
  const cached = await caches.default.match(key);
  if (cached) return cached;

  const fr = /-fr(\.xlsx|\.svg)?$/.test(path);
  const lang: 'en' | 'fr' = fr ? 'fr' : 'en';
  let res: Response | null = null;

  if (path.includes('gun-stores-per-capita-wide')) {
    const stores = await retailers(env);
    const counts: Record<string, number> = {};
    for (const s of stores) counts[s.province] = (counts[s.province] ?? 0) + 1;
    res = new Response(percapitaWideSvg(counts, fr), { headers: { 'content-type': 'image/svg+xml' } });
  } else if (path.includes('ct-firearms-by-province')) {
    const locs = await ctLocations(env);
    if (!locs.length) return Response.redirect(url.origin + path.replace('.svg', '.png'), 302);
    const rows = deriveCt(locs, await retailers(env));
    const byProv = new Map<string, { yes: number; no: number }>();
    for (const r of rows) {
      const e = byProv.get(r.province) ?? { yes: 0, no: 0 };
      e[r.firearms === 'yes' ? 'yes' : 'no'] += 1;
      byProv.set(r.province, e);
    }
    const data = [...byProv.entries()].map(([prov, v]) => ({ prov, ...v }));
    res = new Response(ctChartSvg(data, fr), { headers: { 'content-type': 'image/svg+xml' } });
  } else if (path.includes('canadian-tire-stores')) {
    const locs = await ctLocations(env);
    if (!locs.length) return null; // fall back to the static asset until ct_locations is seeded
    const rows = ctSheetRows(deriveCt(locs, await retailers(env)), lang);
    if (path.endsWith('.xlsx')) {
      const xl = buildXlsx([{
        name: lang === 'fr' ? 'Canadian Tire' : 'Canadian Tire',
        rows: [{ cells: CT_HEADERS[lang], style: 1 }, ...rows.map((r) => ({ cells: r.cells }))],
      }]);
      res = xlsxResponse(xl, path);
    } else {
      res = htmlResponse(sheetHtml(TITLES.ct[lang], lang, CT_HEADERS[lang], rows,
        fr ? '/sheets/canadian-tire-stores' : '/sheets/canadian-tire-stores-fr', `${path}.xlsx`, true));
    }
  } else {
    const stores = await retailers(env);
    const rows = rbcRows(stores, lang);
    if (path.endsWith('.xlsx')) {
      const counts = new Map<string, number>();
      for (const s of stores) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
      const summary = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const xl = buildXlsx([
        { name: lang === 'fr' ? 'Tous les détaillants' : 'All retailers',
          rows: [{ cells: RBC_HEADERS[lang], style: 1 },
                 ...rows.map((r) => (r.banner !== undefined ? { cells: [r.banner], style: 2 } : { cells: r.cells }))] },
        { name: lang === 'fr' ? 'Sommaire' : 'Summary',
          rows: [{ cells: [lang === 'fr' ? 'Catégorie' : 'Category', lang === 'fr' ? 'Nombre' : 'Count'] },
                 ...summary.map(([c, n]) => ({ cells: [c, n] })), { cells: ['TOTAL', stores.length] }] },
      ]);
      res = xlsxResponse(xl, path);
    } else {
      res = htmlResponse(sheetHtml(TITLES.rbc[lang], lang, RBC_HEADERS[lang], rows,
        fr ? '/sheets/retailers-by-category' : '/sheets/retailers-by-category-fr', `${path}.xlsx`, false));
    }
  }

  res.headers.set('cache-control', 'public, max-age=60, s-maxage=300');
  ctx.waitUntil(caches.default.put(key, res.clone()));
  return res;
}

const htmlResponse = (html: string) =>
  new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const xlsxResponse = (data: Uint8Array, path: string) =>
  new Response(data.buffer as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${path.split('/').pop()}"`,
    },
  });
