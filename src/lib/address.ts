import { PROVINCES, type Province } from '../../shared/const';

export interface ParsedAddress {
  address: string;
  city: string | null;
  province: Province | null;
  postal: string | null;
}

const POSTAL_RE = /[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/;
const PROV_RE = new RegExp(`(?:^|[\\s,])(${PROVINCES.join('|')})(?=$|[\\s,.])`);

// Splits a pasted one-line address, e.g. "22789 Hagerty Rd, Newbury, ON N0L 1Z0".
// Returns null when nothing resembling a street address is left after stripping
// the postal code and province.
export function parseAddress(input: string): ParsedAddress | null {
  let s = input.trim();
  if (!s) return null;

  const postalM = s.match(POSTAL_RE);
  const postal = postalM
    ? postalM[0].toUpperCase().replace(/\s+/, '').replace(/^(.{3})/, '$1 ')
    : null;
  if (postalM) s = s.replace(postalM[0], '');

  const provM = s.toUpperCase().match(PROV_RE);
  if (provM) {
    const i = s.toUpperCase().lastIndexOf(provM[1]);
    s = s.slice(0, i) + s.slice(i + 2);
  }

  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  return {
    address: parts[0],
    city: parts[1] ?? null,
    province: (provM ? provM[1] : null) as Province | null,
    postal,
  };
}
