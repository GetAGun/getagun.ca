export const CATEGORIES = [
  'independent',
  'home-hardware',
  'canadian-tire',
  'pronature',
  'ecotone',
  'bass-pro-cabelas',
  'sail',
  'latulippe',
  'coop',
  'fcnq',
  'northern',
  'gunsmith',
] as const;
export type Category = (typeof CATEGORIES)[number];

// Drawn as half-white split pins instead of a solid dot.
export const SPLIT_CATEGORIES = ['coop', 'northern'] as const;

export const CATEGORY_LABELS: Record<Category, { en: string; fr: string }> = {
  independent: { en: 'Independent firearms retailer', fr: "Détaillant d'armes à feu indépendant" },
  'home-hardware': { en: 'Home Hardware', fr: 'Home Hardware' },
  'canadian-tire': { en: 'Canadian Tire', fr: 'Canadian Tire' },
  pronature: { en: 'Pronature', fr: 'Pronature' },
  ecotone: { en: 'Ecotone', fr: 'Écotone' },
  'bass-pro-cabelas': { en: "Bass Pro / Cabela's", fr: "Bass Pro / Cabela's" },
  sail: { en: 'SAIL', fr: 'SAIL' },
  latulippe: { en: 'Latulippe', fr: 'Latulippe' },
  coop: { en: 'Co-op', fr: 'Co-op' },
  fcnq: { en: 'FCNQ', fr: 'FCNQ' },
  northern: { en: 'Northern Store', fr: 'Magasin Northern' },
  gunsmith: { en: 'Gunsmith', fr: 'Armurier' },
};

export const CATEGORY_COLORS: Record<Category, string> = {
  independent: '#eab308',
  'home-hardware': '#ef4444',
  'canadian-tire': '#991b1b',
  pronature: '#0d9488',
  ecotone: '#16a34a',
  'bass-pro-cabelas': '#14532d',
  sail: '#f97316',
  latulippe: '#1e3a8a',
  coop: '#d2042d', // cherry half of the split pin; the map and UI render white/cherry
  fcnq: '#9bc4e2',
  northern: '#0067b1', // blue half of the split pin; the map and UI render white/blue
  gunsmith: '#6b7280',
};

// Shooting ranges are a separate dataset from retailers: they must not reach the
// store counts, the per-capita charts or the retailer spreadsheets.
export const RANGE_KINDS = ['indoor', 'outdoor', 'hybrid'] as const;
export type RangeKind = (typeof RANGE_KINDS)[number];
export const RANGE_ACCESS = ['public', 'private'] as const;
export type RangeAccess = (typeof RANGE_ACCESS)[number];

export const RANGE_KIND_LABELS: Record<RangeKind, { en: string; fr: string }> = {
  indoor: { en: 'Indoor', fr: 'Intérieur' },
  outdoor: { en: 'Outdoor', fr: 'Extérieur' },
  hybrid: { en: 'Hybrid', fr: 'Mixte' },
};
export const RANGE_ACCESS_LABELS: Record<RangeAccess, { en: string; fr: string }> = {
  public: { en: 'Public access', fr: 'Accès public' },
  private: { en: 'Members only', fr: 'Membres seulement' },
};
// Green for public, red for private — matches the icon art in /public/icons.
export const RANGE_ACCESS_COLORS: Record<RangeAccess, string> = {
  public: '#16a34a',
  private: '#dc2626',
};
export const rangeIcon = (a: RangeAccess, k: RangeKind) => `range-${a}-${k}`;

// Population estimates: Statistics Canada, April 1, 2026. Shared so the worker's
// chart SVGs and the interactive client charts can never disagree.
export const PROVINCE_POP: Record<string, number> = {
  NL: 547910, PE: 181715, NS: 1090852, NB: 866497, QC: 9016222, ON: 16103890,
  MB: 1503865, SK: 1266092, AB: 5057077, BC: 5646420, YT: 48493, NT: 45808, NU: 42215,
};
export const TERRITORIES = ['YT', 'NT', 'NU'];

export interface ChartData {
  counts: Record<string, number>;
  ct: Array<{ prov: string; yes: number; no: number }>;
}

export const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'] as const;
export type Province = (typeof PROVINCES)[number];

export interface Retailer {
  id: number;
  name: string;
  address: string;
  city: string;
  province: Province;
  postal: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  website: string | null;
  description: string | null;
  category: Category;
}

export interface ShootingRange {
  id: number;
  name: string;
  address: string;
  city: string;
  province: Province;
  postal: string | null;
  lat: number;
  lon: number;
  phone: string | null;
  website: string | null;
  description: string | null;
  kind: RangeKind;
  access: RangeAccess;
}

export const SUGGESTION_KINDS =['new', 'update', 'feedback'] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export interface Suggestion {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  note: string | null;
  kind: SuggestionKind;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Faq {
  id: number;
  question_en: string;
  answer_en: string;
  question_fr: string | null;
  answer_fr: string | null;
  position: number;
}

// --- Door-to-door flyer canvassing -----------------------------------------
// Internal to /admin/canvass, so these labels stay English-only: unlike the
// public site, the only reader is the person holding the flyers.

export const CANVASS_FLAGS = [
  'flyer', 'convo', 'not_home', 'wants_info', 'licensed', 'dnc',
] as const;
export type CanvassFlag = (typeof CANVASS_FLAGS)[number];

export const CANVASS_FLAG_LABELS: Record<CanvassFlag, string> = {
  flyer: 'Flyer left',
  convo: 'Talked at door',
  not_home: 'No answer',
  wants_info: 'Wants PAL/RPAL info',
  licensed: 'Already licensed',
  dnc: 'Do not contact',
};

// A diverging scale deliberately clear of the brand red: #e6262a reading as
// "very against" on this of all sites would say the wrong thing entirely.
// Neutral borrows the steel token so the scale sits inside the site palette.
export const CANVASS_SENTIMENT = [
  { value: -2, label: 'Very against', face: '\u{1F620}', color: '#8c1c2b' },
  { value: -1, label: 'Slightly against', face: '\u{1F641}', color: '#c2661a' },
  { value: 0, label: 'Neutral', face: '\u{1F610}', color: '#5a5f68' },
  { value: 1, label: 'Slightly for', face: '\u{1F642}', color: '#2f7d6b' },
  { value: 2, label: 'Very for', face: '\u{1F603}', color: '#1c5c34' },
] as const;

// A door that was logged but never gave a view, and one not yet knocked.
export const CANVASS_TOUCHED_COLOR = '#15161a';
export const CANVASS_UNLOGGED_COLOR = '#b6afa4';

export type CanvassRow = {
  id: number;
  address: string;
  sentiment: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  updated: number;
} & Record<CanvassFlag, number>;

/** One door from the static address data: [id, number, label, unit, lat, lon, landuse, ward] */
export type CanvassDoorRow = [number, number, string, string, number, number, string, string];

export interface CanvassStreet {
  id: number;
  name: string;
  lat: number;
  lon: number;
  doors: number;
  residential: number;
}
