export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearest<T extends { lat: number; lon: number }>(
  items: T[],
  lat: number,
  lon: number,
  n = 10,
): (T & { distanceKm: number })[] {
  return items
    .map((it) => ({ ...it, distanceKm: haversineKm(lat, lon, it.lat, it.lon) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, n);
}
