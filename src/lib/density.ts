
// Census division boundaries (2021 cartographic, simplified) with population.
export interface CdFeature {
  type: 'Feature';
  properties: { id: string; n: string; p: number };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}
export interface CdCollection {
  type: 'FeatureCollection';
  features: CdFeature[];
}

function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, poly: number[][][]): boolean {
  if (!inRing(x, y, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (inRing(x, y, poly[i])) return false;
  return true;
}

function contains(f: CdFeature, x: number, y: number): boolean {
  const g = f.geometry;
  if (g.type === 'Polygon') return inPolygon(x, y, g.coordinates as number[][][]);
  return (g.coordinates as number[][][][]).some((p) => inPolygon(x, y, p));
}

const bboxes = new WeakMap<CdFeature, [number, number, number, number]>();
function bbox(f: CdFeature): [number, number, number, number] {
  let b = bboxes.get(f);
  if (b) return b;
  b = [Infinity, Infinity, -Infinity, -Infinity];
  const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  bboxes.set(f, b);
  return b;
}

// Stores per 100,000 residents in each census division, keyed by division id.
export function densityByCd(cds: CdCollection, points: Array<{ lat: number; lon: number }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of points) {
    const f = cds.features.find((f) => {
      const b = bbox(f);
      return r.lon >= b[0] && r.lon <= b[2] && r.lat >= b[1] && r.lat <= b[3] && contains(f, r.lon, r.lat);
    });
    if (f) counts.set(f.properties.id, (counts.get(f.properties.id) ?? 0) + 1);
  }
  const rates = new Map<string, number>();
  for (const f of cds.features)
    rates.set(f.properties.id, f.properties.p > 0 ? ((counts.get(f.properties.id) ?? 0) / f.properties.p) * 1e5 : 0);
  return rates;
}

// Class breaks (per 100k) and fill colours shared by the map layer and the legend.
// Ranges are roughly a fifth as common as stores, so the retail scale would put
// nearly every division in the lightest band. Same ramp, compressed.
export const RANGE_DENSITY_STOPS: Array<[number, string]> = [
  [0, '#f5efec'],
  [0.001, '#fee5d9'],
  [0.25, '#fcbba1'],
  [0.5, '#fc9272'],
  [1, '#fb6a4a'],
  [2, '#de2d26'],
  [4, '#a50f15'],
];

export const DENSITY_STOPS: Array<[number, string]> = [
  [0, '#f5efec'],
  [0.001, '#fee5d9'],
  [1, '#fcbba1'],
  [2, '#fc9272'],
  [4, '#fb6a4a'],
  [8, '#de2d26'],
  [16, '#a50f15'],
];

let cdPromise: Promise<CdCollection> | null = null;
export function loadCds(): Promise<CdCollection> {
  cdPromise ??= fetch('/cd-density.json').then((r) => {
    if (!r.ok) throw new Error(`cd-density ${r.status}`);
    return r.json() as Promise<CdCollection>;
  });
  return cdPromise;
}
