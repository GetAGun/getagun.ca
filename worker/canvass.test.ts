import { describe, expect, it } from 'vitest';
import { validateCanvassBatch } from './canvass';

const door = {
  id: 66875, address: '397 Wharncliffe Rd N', sentiment: 2, updated: 1756200000000,
  flyer: 1, convo: 1, wants_info: 1, name: 'A Resident', phone: '519-555-0134',
  notes: 'Asked about the safety course.',
};

describe('validateCanvassBatch', () => {
  it('accepts a batch of logged doors', () => {
    const r = validateCanvassBatch([door]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[0].wants_info).toBe(1);
      expect(r.value[0].licensed).toBe(0);
      expect(r.value[0].name).toBe('A Resident');
    }
  });

  it('treats an absent or empty sentiment as not asked', () => {
    for (const sentiment of [undefined, null, '']) {
      const r = validateCanvassBatch([{ ...door, sentiment }]);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0].sentiment).toBeNull();
    }
  });

  it('keeps the whole scale, including the negative end', () => {
    for (const s of [-2, -1, 0, 1, 2]) {
      const r = validateCanvassBatch([{ ...door, sentiment: s }]);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0].sentiment).toBe(s);
    }
  });

  it('rejects a sentiment off the scale', () => {
    expect(validateCanvassBatch([{ ...door, sentiment: 3 }]).ok).toBe(false);
    expect(validateCanvassBatch([{ ...door, sentiment: 1.5 }]).ok).toBe(false);
  });

  it('rejects rows that cannot be keyed or ordered', () => {
    expect(validateCanvassBatch([{ ...door, id: 'abc' }]).ok).toBe(false);
    expect(validateCanvassBatch([{ ...door, id: 0 }]).ok).toBe(false);
    expect(validateCanvassBatch([{ ...door, address: '   ' }]).ok).toBe(false);
    expect(validateCanvassBatch([{ ...door, updated: 0 }]).ok).toBe(false);
  });

  it('rejects a body that is not an array, and an oversized batch', () => {
    expect(validateCanvassBatch(null).ok).toBe(false);
    expect(validateCanvassBatch({ id: 1 }).ok).toBe(false);
    expect(validateCanvassBatch(Array(501).fill(door)).ok).toBe(false);
  });

  it('trims text and drops fields that are blank or too long', () => {
    const r = validateCanvassBatch([{ ...door, name: '  Spaced  ', notes: 'x'.repeat(4001), email: '' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[0].name).toBe('Spaced');
      expect(r.value[0].notes).toBeNull();
      expect(r.value[0].email).toBeNull();
    }
  });

  it('coerces any truthy flag value to 0 or 1', () => {
    const r = validateCanvassBatch([{ ...door, dnc: 'yes', licensed: 0 }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.value[0].dnc, r.value[0].licensed]).toEqual([1, 0]);
  });
});
