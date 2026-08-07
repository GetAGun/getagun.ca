import { describe, expect, it } from 'vitest';
import { densityByCd, type CdCollection } from './density';
import type { Retailer } from '../../shared/const';

const square = (id: string, p: number, x0: number, y0: number, hole = false): CdCollection['features'][number] => ({
  type: 'Feature',
  properties: { id, n: id, p },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[x0, y0], [x0 + 10, y0], [x0 + 10, y0 + 10], [x0, y0 + 10], [x0, y0]],
      ...(hole ? [[[x0 + 4, y0 + 4], [x0 + 6, y0 + 4], [x0 + 6, y0 + 6], [x0 + 4, y0 + 6], [x0 + 4, y0 + 4]]] : []),
    ],
  },
});

const store = (id: number, lon: number, lat: number): Retailer =>
  ({ id, name: 's', address: 'a', city: 'c', province: 'ON', postal: null, lat, lon,
     phone: null, website: null, description: null, category: 'independent' }) as Retailer;

describe('densityByCd', () => {
  const cds: CdCollection = { type: 'FeatureCollection', features: [square('A', 100000, 0, 0, true), square('B', 50000, 20, 0)] };

  it('assigns stores to containing division and rates per 100k', () => {
    const rates = densityByCd(cds, [store(1, 1, 1), store(2, 2, 2), store(3, 21, 1)]);
    expect(rates.get('A')).toBe(2);
    expect(rates.get('B')).toBe(2);
  });

  it('excludes stores outside all divisions and inside holes', () => {
    const rates = densityByCd(cds, [store(1, 50, 50), store(2, 5, 5)]);
    expect(rates.get('A')).toBe(0);
    expect(rates.get('B')).toBe(0);
  });
});
