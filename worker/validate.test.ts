import { describe, expect, it } from 'vitest';
import { validateRetailer, validateSuggestion } from './validate';

const good = {
  name: 'North Bay Guns', address: '12 Main St', city: 'North Bay', province: 'ON',
  postal: 'P1B 1A1', lat: 46.3, lon: -79.46, phone: '705-555-0100',
  website: 'https://example.com', description: 'Family shop.', category: 'independent',
};

describe('validateRetailer', () => {
  it('accepts a complete valid retailer', () => {
    const r = validateRetailer(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('North Bay Guns');
  });
  it('normalizes absent optionals to null', () => {
    const { postal, phone, website, description, ...required } = good;
    const r = validateRetailer(required);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.website).toBeNull();
  });
  it('rejects non-object bodies', () => {
    expect(validateRetailer(null).ok).toBe(false);
    expect(validateRetailer('hi').ok).toBe(false);
  });
  it('rejects missing name', () => {
    expect(validateRetailer({ ...good, name: '  ' }).ok).toBe(false);
  });
  it('rejects unknown category and province', () => {
    expect(validateRetailer({ ...good, category: 'walmart' }).ok).toBe(false);
    expect(validateRetailer({ ...good, province: 'XX' }).ok).toBe(false);
  });
  it('rejects coordinates outside Canada', () => {
    expect(validateRetailer({ ...good, lat: 12 }).ok).toBe(false);
    expect(validateRetailer({ ...good, lon: 5 }).ok).toBe(false);
    expect(validateRetailer({ ...good, lat: '46' }).ok).toBe(false);
  });
  it('rejects a non-URL website', () => {
    expect(validateRetailer({ ...good, website: 'javascript:alert(1)' }).ok).toBe(false);
  });
});

describe('validateSuggestion', () => {
  it('accepts name-only', () => {
    const r = validateSuggestion({ name: 'Some Shop' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.city).toBeNull();
  });
  it('rejects missing name and over-length note', () => {
    expect(validateSuggestion({}).ok).toBe(false);
    expect(validateSuggestion({ name: 'x', note: 'a'.repeat(1001) }).ok).toBe(false);
  });
  it('rejects bad province when given', () => {
    expect(validateSuggestion({ name: 'x', province: 'ZZ' }).ok).toBe(false);
    expect(validateSuggestion({ name: 'x', province: 'QC' }).ok).toBe(true);
  });
  it('normalizes whitespace-only optionals to null', () => {
    const r = validateSuggestion({ name: 'x', city: '   ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.city).toBeNull();
  });
  it('treats whitespace-only website as absent, not invalid', () => {
    const r = validateSuggestion({ name: 'x', website: '  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.website).toBeNull();
  });
  it('defaults kind to new and rejects unknown kinds', () => {
    const r = validateSuggestion({ name: 'x' });
    expect(r.ok && r.value.kind === 'new').toBe(true);
    expect(validateSuggestion({ name: 'x', kind: 'spam' }).ok).toBe(false);
  });
  it('requires a note for updates and feedback', () => {
    expect(validateSuggestion({ name: 'x', kind: 'update' }).ok).toBe(false);
    expect(validateSuggestion({ name: 'x', kind: 'update', note: 'moved' }).ok).toBe(true);
    expect(validateSuggestion({ kind: 'feedback' }).ok).toBe(false);
    const fb = validateSuggestion({ kind: 'feedback', note: 'great site' });
    expect(fb.ok && fb.value.name === 'Feedback').toBe(true);
  });
});
