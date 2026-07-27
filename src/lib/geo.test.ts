import { describe, expect, it } from 'vitest';
import { haversineKm, nearest } from './geo';

describe('haversineKm', () => {
  it('CN Tower to Parliament Hill is ~352 km', () => {
    const d = haversineKm(43.6426, -79.3871, 45.4236, -75.7009);
    expect(d).toBeGreaterThan(340);
    expect(d).toBeLessThan(365);
  });
  it('zero distance to itself', () => {
    expect(haversineKm(50, -100, 50, -100)).toBe(0);
  });
});

describe('nearest', () => {
  const items = [
    { id: 'far', lat: 49.28, lon: -123.12 }, // Vancouver
    { id: 'near', lat: 43.7, lon: -79.4 },   // Toronto
    { id: 'mid', lat: 45.5, lon: -73.57 },   // Montreal
  ];
  it('sorts by distance from Ottawa and annotates distanceKm', () => {
    const r = nearest(items, 45.42, -75.7);
    expect(r.map((x) => x.id)).toEqual(['mid', 'near', 'far']);
    expect(r[0].distanceKm).toBeLessThan(r[1].distanceKm);
  });
  it('caps at n', () => {
    expect(nearest(items, 45.42, -75.7, 2)).toHaveLength(2);
  });
});
