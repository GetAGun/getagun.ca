import {
  CANVASS_FLAGS, CANVASS_SENTIMENT, CANVASS_TOUCHED_COLOR, CANVASS_UNLOGGED_COLOR,
  type CanvassDoorRow, type CanvassRow, type CanvassStreet,
} from '../../shared/const';

export interface Door {
  id: number;
  number: number;
  label: string;
  unit: string;
  lat: number;
  lon: number;
  landuse: string;
  ward: string;
  street: string;
  address: string;
}

export type SyncState = 'ok' | 'pending' | 'error' | 'offline';

const KEY = { log: 'gag.canvass.log', queue: 'gag.canvass.queue', since: 'gag.canvass.since' };
type Sentiment = (typeof CANVASS_SENTIMENT)[number];
const SENTIMENT_BY_VALUE = new Map<number, Sentiment>(CANVASS_SENTIMENT.map((s) => [s.value, s]));

export const sentimentOf = (row?: CanvassRow) =>
  row && row.sentiment !== null ? SENTIMENT_BY_VALUE.get(row.sentiment) : undefined;

export const isLogged = (row?: CanvassRow): boolean =>
  !!row && (row.sentiment !== null || CANVASS_FLAGS.some((f) => row[f]) ||
    !!row.name || !!row.phone || !!row.email || !!row.notes);

export function stripeColor(row?: CanvassRow): string {
  if (!isLogged(row)) return CANVASS_UNLOGGED_COLOR;
  return sentimentOf(row)?.color ?? CANVASS_TOUCHED_COLOR;
}

export const blankRow = (id: number, address: string): CanvassRow => ({
  id, address, sentiment: null, name: null, phone: null, email: null, notes: null,
  updated: 0, flyer: 0, convo: 0, not_home: 0, wants_info: 0, licensed: 0, dnc: 0,
});

// --- static address data ----------------------------------------------------

export async function loadStreets(): Promise<CanvassStreet[]> {
  const body = (await (await fetch('/canvass/streets.json')).json()) as {
    s: [number, string, number, number, number, number][];
  };
  return body.s.map(([id, name, lat, lon, doors, residential]) =>
    ({ id, name, lat, lon, doors, residential }));
}

const streetCache = new Map<number, Door[]>();

export async function loadDoors(streetId: number): Promise<Door[]> {
  const cached = streetCache.get(streetId);
  if (cached) return cached;
  const body = (await (await fetch(`/canvass/addr/${streetId}.json`)).json()) as {
    n: string; a: CanvassDoorRow[];
  };
  const doors = body.a.map(([id, number, label, unit, lat, lon, landuse, ward]) => ({
    id, number, label, unit, lat, lon, landuse, ward,
    street: body.n,
    address: `${label} ${body.n}`.trim(),
  }));
  streetCache.set(streetId, doors);
  return doors;
}

// --- local store ------------------------------------------------------------
// Every save lands here before it lands anywhere else: a door logged in a dead
// zone must survive the phone being closed, running out of battery, or crashing.

const log = new Map<number, CanvassRow>();
const queue = new Set<number>();
let since = 0;
let syncState: SyncState = 'ok';
let lastError = '';
let version = 0;
const listeners = new Set<() => void>();

const announce = () => { version += 1; listeners.forEach((fn) => fn()); };

export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const snapshot = () => version;
export const getRow = (id: number) => log.get(id);
export const getSyncState = () => syncState;
export const getSyncError = () => lastError;
export const pendingCount = () => queue.size;

function persist() {
  try {
    localStorage.setItem(KEY.log, JSON.stringify([...log.values()]));
    localStorage.setItem(KEY.queue, JSON.stringify([...queue]));
    localStorage.setItem(KEY.since, String(since));
  } catch {
    // A full or disabled localStorage must not take the running app down; the
    // rows are still in memory and still queued for the next flush.
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function restore(): void {
  read<CanvassRow[]>(KEY.log, []).forEach((r) => log.set(r.id, r));
  read<number[]>(KEY.queue, []).forEach((id) => queue.add(id));
  since = Number(read<string | number>(KEY.since, 0)) || 0;
  syncState = queue.size ? 'pending' : 'ok';
  announce();
}

let flushTimer = 0;

export function save(row: CanvassRow): void {
  log.set(row.id, { ...row, updated: Date.now() });
  queue.add(row.id);
  syncState = 'pending';
  persist();
  announce();
  // Flush shortly after the last save rather than waiting for the poll, so a
  // door is on the server within seconds of the canvasser walking away.
  clearTimeout(flushTimer);
  flushTimer = window.setTimeout(sync, 800);
}

// --- sync -------------------------------------------------------------------

class SessionExpired extends Error {}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  // An expired Access session answers with its own sign-in page, not a 401, so
  // a non-JSON body is the only reliable tell.
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new SessionExpired('session expired');
  }
  const body = (await res.json()) as { error?: string } & Record<string, unknown>;
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

let running = false;

export async function sync(): Promise<void> {
  if (running) return;
  if (!navigator.onLine) { syncState = 'offline'; announce(); return; }
  running = true;
  try {
    if (queue.size) {
      const batch = [...queue].slice(0, 500);
      const rows = batch.map((id) => log.get(id)).filter(Boolean) as CanvassRow[];
      await call('/api/admin/canvass', { method: 'POST', body: JSON.stringify(rows) });
      batch.forEach((id) => queue.delete(id));
    }
    const body = await call(`/api/admin/canvass?since=${since}`);
    for (const row of (body.rows ?? []) as CanvassRow[]) {
      const mine = log.get(row.id);
      if (mine && (queue.has(row.id) || mine.updated >= row.updated)) continue;
      log.set(row.id, row);
    }
    // Rewind the watermark five minutes: `updated` comes from whichever device
    // wrote the row, so clock skew would otherwise drop an edit made elsewhere.
    since = Math.max(0, Number(body.now) - 300_000);
    syncState = queue.size ? 'pending' : 'ok';
    lastError = '';
    persist();
  } catch (err) {
    if (err instanceof SessionExpired) {
      syncState = 'error';
      lastError = 'Your session expired. Reload the page to sign in again.';
    } else if (!navigator.onLine) {
      syncState = 'offline';
      lastError = '';
    } else {
      syncState = 'error';
      lastError = `The server rejected the sync (${(err as Error).message}).`;
    }
  } finally {
    running = false;
    announce();
  }
}

export function syncLabel(): string {
  const held = queue.size ? ` — ${queue.size} saved on this phone` : '';
  switch (syncState) {
    case 'ok': return 'Synced';
    case 'pending': return `Syncing${held}`;
    case 'offline': return `Offline${held}`;
    default: return `Not syncing${held}`;
  }
}
