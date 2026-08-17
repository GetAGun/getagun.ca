import { describe, expect, it } from 'vitest';
import { parseAddress } from './address';

describe('parseAddress', () => {
  it('splits a full address with postal code and province', () => {
    expect(parseAddress('22789 Hagerty Rd, Newbury, ON N0L 1Z0')).toEqual({
      address: '22789 Hagerty Rd', city: 'Newbury', province: 'ON', postal: 'N0L 1Z0',
    });
  });

  it('normalises a postal code typed without a space', () => {
    expect(parseAddress('1 Main St, Ottawa, ON K1A0B1')?.postal).toBe('K1A 0B1');
  });

  it('handles a missing postal code or province', () => {
    expect(parseAddress('5 Range Rd, Barrie')).toEqual({
      address: '5 Range Rd', city: 'Barrie', province: null, postal: null,
    });
  });

  it('keeps the street when there is no city', () => {
    expect(parseAddress('123 Lonely Lane')).toEqual({
      address: '123 Lonely Lane', city: null, province: null, postal: null,
    });
  });

  it('does not mistake a street name for a province code', () => {
    // "Ontario St" must not have its "ON" stripped out of the street name.
    expect(parseAddress('44 Ontario St, Kingston, ON K7L 2Y8')).toEqual({
      address: '44 Ontario St', city: 'Kingston', province: 'ON', postal: 'K7L 2Y8',
    });
  });

  it('returns null for empty or postal-only input', () => {
    expect(parseAddress('   ')).toBeNull();
    expect(parseAddress('K1A 0B1')).toBeNull();
  });
});
