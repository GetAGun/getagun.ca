// Canada-scoped Photon geocoding. The query goes to the community-run Photon
// service (photon.komoot.io) — disclosed in the privacy note. Nothing is sent
// to our own server.
const CANADA_BBOX = '-141.1,41.6,-52.5,83.2';

export interface GeocodeHit {
  label: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; housenumber?: string; street?: string;
    city?: string; state?: string; postcode?: string; countrycode?: string;
  };
}

export async function geocode(q: string, lang: 'en' | 'fr'): Promise<GeocodeHit[]> {
  const url = `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=5&lang=${lang}&bbox=${CANADA_BBOX}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features
    .filter((f) => f.properties.countrycode === 'CA')
    .map((f) => {
      const p = f.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const label = [p.name, street || null, p.city, p.state].filter(Boolean).join(', ');
      return { label, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    });
}

const PROVINCE_CODE: Record<string, string> = {
  Alberta: 'AB', 'British Columbia': 'BC', 'Colombie-Britannique': 'BC', Manitoba: 'MB',
  'New Brunswick': 'NB', 'Nouveau-Brunswick': 'NB', 'Newfoundland and Labrador': 'NL',
  'Terre-Neuve-et-Labrador': 'NL', 'Nova Scotia': 'NS', 'Nouvelle-Écosse': 'NS',
  'Northwest Territories': 'NT', 'Territoires du Nord-Ouest': 'NT', Nunavut: 'NU',
  Ontario: 'ON', 'Prince Edward Island': 'PE', 'Île-du-Prince-Édouard': 'PE',
  Quebec: 'QC', 'Québec': 'QC', Saskatchewan: 'SK', Yukon: 'YT',
};

export interface ReverseHit {
  address: string;
  city: string;
  province: string | null;
  postal: string | null;
}

export async function reverseGeocode(lat: number, lon: number): Promise<ReverseHit | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`photon reverse ${res.status}`);
  const data = (await res.json()) as { features: PhotonFeature[] };
  const p = data.features?.[0]?.properties;
  if (!p) return null;
  return {
    address: [p.housenumber, p.street].filter(Boolean).join(' '),
    city: p.city ?? '',
    province: PROVINCE_CODE[p.state ?? ''] ?? null,
    postal: p.postcode ?? null,
  };
}
