import { CATEGORIES, PROVINCES, RANGE_ACCESS, RANGE_KINDS, SUGGESTION_KINDS, type SuggestionKind } from '../shared/const';

const CANADA = { latMin: 41.6, latMax: 83.2, lonMin: -141.1, lonMax: -52.5 };
const URL_RE = /^https?:\/\/\S+$/i;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Retailers and ranges carry the same location fields; only the classifier differs.
export interface PlaceInput {
  name: string; address: string; city: string; province: string;
  postal: string | null; lat: number; lon: number; phone: string | null;
  website: string | null; description: string | null;
}
export interface RetailerInput extends PlaceInput { category: string }
export interface RangeInput extends PlaceInput { kind: string; access: string }

export interface SuggestionInput {
  name: string; address: string | null; city: string | null;
  province: string | null; website: string | null; note: string | null;
  kind: SuggestionKind;
}

function reqStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

// returns undefined on invalid, null when absent/empty
function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t === '') return null;
  if (t.length > max) return undefined;
  return t;
}

function optUrl(v: unknown): string | null | undefined {
  const s = optStr(v, 200);
  if (s === null || s === undefined) return s;
  return URL_RE.test(s) ? s : undefined;
}

function validatePlace(body: unknown): Result<PlaceInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const name = reqStr(b.name, 120);
  const address = reqStr(b.address, 200);
  const city = reqStr(b.city, 80);
  if (!name) return { ok: false, error: 'name is required (max 120 chars)' };
  if (!address) return { ok: false, error: 'address is required (max 200 chars)' };
  if (!city) return { ok: false, error: 'city is required (max 80 chars)' };
  if (!PROVINCES.includes(b.province as never)) return { ok: false, error: 'invalid province' };
  if (typeof b.lat !== 'number' || b.lat < CANADA.latMin || b.lat > CANADA.latMax)
    return { ok: false, error: 'lat outside Canada' };
  if (typeof b.lon !== 'number' || b.lon < CANADA.lonMin || b.lon > CANADA.lonMax)
    return { ok: false, error: 'lon outside Canada' };
  const postal = optStr(b.postal, 10);
  const phone = optStr(b.phone, 30);
  const description = optStr(b.description, 1000);
  const website = optUrl(b.website);
  if (postal === undefined) return { ok: false, error: 'postal too long' };
  if (phone === undefined) return { ok: false, error: 'phone too long' };
  if (description === undefined) return { ok: false, error: 'description too long' };
  if (website === undefined) return { ok: false, error: 'website must be an http(s) URL (max 200 chars)' };
  return {
    ok: true,
    value: { name, address, city, province: b.province as string, postal, lat: b.lat, lon: b.lon, phone, website, description },
  };
}

export function validateRetailer(body: unknown): Result<RetailerInput> {
  const b = body as Record<string, unknown> | null;
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid body' };
  if (!CATEGORIES.includes(b!.category as never)) return { ok: false, error: 'invalid category' };
  const base = validatePlace(body);
  return base.ok ? { ok: true, value: { ...base.value, category: b!.category as string } } : base;
}

export function validateRange(body: unknown): Result<RangeInput> {
  const b = body as Record<string, unknown> | null;
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid body' };
  if (!RANGE_KINDS.includes(b!.kind as never)) return { ok: false, error: 'invalid kind' };
  if (!RANGE_ACCESS.includes(b!.access as never)) return { ok: false, error: 'invalid access' };
  const base = validatePlace(body);
  return base.ok ? { ok: true, value: { ...base.value, kind: b!.kind as string, access: b!.access as string } } : base;
}

export function validateSuggestion(body: unknown): Result<SuggestionInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const kind: SuggestionKind = b.kind === undefined ? 'new' : (b.kind as SuggestionKind);
  if (!SUGGESTION_KINDS.includes(kind)) return { ok: false, error: 'invalid kind' };
  // feedback needs no retailer name; new/update do
  const name = reqStr(b.name, 120) ?? (kind === 'feedback' ? 'Feedback' : null);
  if (!name) return { ok: false, error: 'name is required (max 120 chars)' };
  const address = optStr(b.address, 200);
  const city = optStr(b.city, 80);
  const note = optStr(b.note, 1000);
  const website = optUrl(b.website);
  if (address === undefined) return { ok: false, error: 'address too long' };
  if (city === undefined) return { ok: false, error: 'city too long' };
  if (note === undefined) return { ok: false, error: 'note too long' };
  if (website === undefined) return { ok: false, error: 'website must be an http(s) URL (max 200 chars)' };
  if ((kind === 'update' || kind === 'feedback') && !note) {
    return { ok: false, error: 'a note describing the update or feedback is required' };
  }
  let province: string | null = null;
  if (b.province !== undefined && b.province !== null && b.province !== '') {
    if (!PROVINCES.includes(b.province as never)) return { ok: false, error: 'invalid province' };
    province = b.province as string;
  }
  return { ok: true, value: { name, address, city, province, website, note, kind } };
}

export interface FaqInput {
  question_en: string; answer_en: string;
  question_fr: string | null; answer_fr: string | null;
  position: number;
}

export function validateFaq(body: unknown): Result<FaqInput> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid body' };
  const b = body as Record<string, unknown>;
  const question_en = reqStr(b.question_en, 300);
  if (!question_en) return { ok: false, error: 'question_en is required (max 300 chars)' };
  const answer_en = reqStr(b.answer_en, 5000);
  if (!answer_en) return { ok: false, error: 'answer_en is required (max 5000 chars)' };
  const question_fr = optStr(b.question_fr, 300);
  const answer_fr = optStr(b.answer_fr, 5000);
  if (question_fr === undefined) return { ok: false, error: 'question_fr too long' };
  if (answer_fr === undefined) return { ok: false, error: 'answer_fr too long' };
  const position = b.position === undefined || b.position === null ? 0 : b.position;
  if (typeof position !== 'number' || !Number.isInteger(position) || position < 0 || position > 9999) {
    return { ok: false, error: 'position must be an integer 0-9999' };
  }
  return { ok: true, value: { question_en, answer_en, question_fr, answer_fr, position } };
}
