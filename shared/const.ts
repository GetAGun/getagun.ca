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
  'gunsmith',
] as const;
export type Category = (typeof CATEGORIES)[number];

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
  gunsmith: '#6b7280',
};

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

export const SUGGESTION_KINDS = ['new', 'update', 'feedback'] as const;
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
