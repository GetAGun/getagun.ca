import { CANVASS_FLAGS, type CanvassRow } from '../shared/const';

// Door-to-door flyer canvassing. Rows are keyed on the City of London GIS_ID
// that the static address data carries, so a data rebuild never orphans a log.
//
// Sync is a queue-and-flush: the canvasser's phone writes to its own storage
// first and posts batches when it has signal, so nothing is lost in a dead zone.

const MAX_BATCH = 500;
const TEXT_LIMITS = { address: 200, name: 120, phone: 40, email: 160, notes: 4000 };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const COLUMNS = [
  'id', 'address', 'sentiment', ...CANVASS_FLAGS,
  'name', 'phone', 'email', 'notes', 'updated',
] as const;

// Last write wins on `updated`, so a door logged offline can never overwrite a
// newer edit made from another device while the phone was out of signal.
const UPSERT = `INSERT INTO canvass_log (${COLUMNS.join(',')})
  VALUES (${COLUMNS.map(() => '?').join(',')})
  ON CONFLICT(id) DO UPDATE SET
    ${COLUMNS.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',')}
  WHERE excluded.updated > canvass_log.updated`;

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' || t.length > max ? null : t;
}

// The batch arrives from the canvasser's browser, so it is still untrusted input.
export function validateCanvassBatch(body: unknown): Result<CanvassRow[]> {
  if (!Array.isArray(body)) return { ok: false, error: 'expected an array' };
  if (body.length > MAX_BATCH) return { ok: false, error: `batch over ${MAX_BATCH}` };

  const rows: CanvassRow[] = [];
  for (const raw of body) {
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'invalid row' };
    const b = raw as Record<string, unknown>;

    const id = Number(b.id);
    if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'invalid id' };

    const address = text(b.address, TEXT_LIMITS.address);
    if (!address) return { ok: false, error: `missing address for ${id}` };

    const updated = Number(b.updated);
    if (!Number.isSafeInteger(updated) || updated <= 0) {
      return { ok: false, error: `invalid timestamp for ${id}` };
    }

    let sentiment: number | null = null;
    if (b.sentiment !== null && b.sentiment !== undefined && b.sentiment !== '') {
      sentiment = Number(b.sentiment);
      if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) {
        return { ok: false, error: `invalid sentiment for ${id}` };
      }
    }

    const row = { id, address, sentiment, updated } as CanvassRow;
    for (const f of CANVASS_FLAGS) row[f] = b[f] ? 1 : 0;
    row.name = text(b.name, TEXT_LIMITS.name);
    row.phone = text(b.phone, TEXT_LIMITS.phone);
    row.email = text(b.email, TEXT_LIMITS.email);
    row.notes = text(b.notes, TEXT_LIMITS.notes);
    rows.push(row);
  }
  return { ok: true, value: rows };
}

export async function readCanvassLog(db: D1Database, since: number): Promise<CanvassRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM canvass_log WHERE updated > ? ORDER BY updated')
    .bind(Number.isSafeInteger(since) && since > 0 ? since : 0)
    .all<CanvassRow>();
  return results;
}

export async function writeCanvassLog(db: D1Database, rows: CanvassRow[]): Promise<void> {
  if (rows.length === 0) return;
  const stmt = db.prepare(UPSERT);
  await db.batch(rows.map((r) => stmt.bind(...COLUMNS.map((c) => r[c]))));
}
