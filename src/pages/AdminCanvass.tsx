import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CANVASS_FLAGS, CANVASS_FLAG_LABELS, CANVASS_SENTIMENT,
  type CanvassFlag, type CanvassRow, type CanvassStreet,
} from '../../shared/const';
import { baseStyle } from '../components/RetailerMap';
import { haversineKm } from '../lib/geo';
import {
  blankRow, getRow, getSyncState, isLogged, loadDoors, loadStreets, pendingCount,
  getSyncError, restore, save, sentimentOf, snapshot, stripeColor, subscribe, sync, syncLabel,
  type Door,
} from '../lib/canvass';

const NEAR_STREETS = 8;
const NEAR_KM = 1.5;

const SYNC_DOT: Record<string, string> = {
  ok: 'bg-emerald-600', pending: 'bg-amber-500', offline: 'bg-steel', error: 'bg-brand',
};

const btn = 'min-h-[44px] rounded-md border border-rule bg-white px-3 py-2 text-sm ' +
  'transition-colors duration-[var(--dur-fast)] hover:bg-paper disabled:opacity-50';
const btnOn = 'min-h-[44px] rounded-md border border-ink bg-ink px-3 py-2 text-sm text-white';
const field = 'w-full rounded-md border border-rule px-3 py-2 text-sm';

export default function AdminCanvass() {
  useSyncExternalStore(subscribe, snapshot);

  const [streets, setStreets] = useState<CanvassStreet[]>([]);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<{ ids: number[]; label: string; note: string } | null>(null);
  const [doors, setDoors] = useState<Door[]>([]);
  const [side, setSide] = useState<'all' | 'odd' | 'even'>('all');
  const [residentialOnly, setResidentialOnly] = useState(true);
  const [mapOn, setMapOn] = useState(false);
  const [here, setHere] = useState<GeolocationPosition | null>(null);
  const [editing, setEditing] = useState<Door | null>(null);
  const [toast, setToast] = useState('');

  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const framed = useRef(false);
  const doorsRef = useRef<Door[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // --- boot ----------------------------------------------------------------
  useEffect(() => {
    restore();
    loadStreets().then(setStreets).catch(() =>
      setToast('Street data did not load. Reconnect once so it can be cached.'));
    sync();
    navigator.serviceWorker?.register('/admin/canvass/sw.js').catch(() => {});

    const online = () => sync();
    const offline = () => sync();
    const wake = () => { if (!document.hidden) sync(); };
    const timer = window.setInterval(sync, 60_000);
    addEventListener('online', online);
    addEventListener('offline', offline);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      removeEventListener('online', online);
      removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', wake);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- selection -----------------------------------------------------------
  const open = useCallback(async (ids: number[], label: string, note: string) => {
    setSelection({ ids, label, note });
    setQuery('');
    framed.current = false;
    const loaded = await Promise.all(ids.map(loadDoors));
    setDoors(loaded.flat());
  }, []);

  useEffect(() => { doorsRef.current = doors; }, [doors]);

  const visible = useMemo(() => doors.filter((d) =>
    (!residentialOnly || d.landuse === 'R') &&
    (side === 'all' || (side === 'odd') === (Math.abs(d.number) % 2 === 1))), [doors, residentialOnly, side]);

  const byStreet = useMemo(() => {
    const groups = new Map<string, Door[]>();
    for (const d of visible) {
      const list = groups.get(d.street);
      if (list) list.push(d); else groups.set(d.street, [d]);
    }
    return [...groups];
  }, [visible]);

  const doneCount = visible.filter((d) => isLogged(getRow(d.id))).length;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return streets
      .filter((s) => s.name.toLowerCase().includes(needle))
      .sort((a, b) =>
        a.name.toLowerCase().indexOf(needle) - b.name.toLowerCase().indexOf(needle) ||
        a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [streets, query]);

  // --- map -----------------------------------------------------------------
  useEffect(() => {
    if (!mapOn || !mapNode.current || map.current) return;
    const m = new maplibregl.Map({
      container: mapNode.current,
      style: baseStyle('light'),
      center: [-81.2453, 42.9849],
      zoom: 11,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    m.on('load', () => {
      m.addSource('doors', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'doors',
        type: 'circle',
        source: 'doors',
        paint: {
          // Doors still to knock stay quiet; a logged one gets a ring so it
          // reads across a whole street of overlapping pins.
          'circle-radius': ['case', ['get', 'done'], 6.5, ['case', ['get', 'unit'], 3.5, 4.5]],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['case', ['get', 'done'], 1, 0.7],
          'circle-stroke-width': ['case', ['get', 'done'], 1.5, 0],
          'circle-stroke-color': '#ffffff',
        },
      });
      m.addSource('me', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({
        id: 'me',
        type: 'circle',
        source: 'me',
        paint: {
          'circle-radius': 7, 'circle-color': '#1b63d8',
          'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff',
        },
      });
      m.on('click', 'doors', (e) => {
        const id = e.features?.[0]?.properties?.id as number | undefined;
        const door = doorsRef.current.find((d) => d.id === id);
        if (door) setEditing(door);
      });
      setMapReady(true);
      m.on('mouseenter', 'doors', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'doors', () => { m.getCanvas().style.cursor = ''; });
    });
    map.current = m;
    // Deliberately not keyed on `doors`: rebuilding the map on every change
    // tore down the layer mid-flight, and the repaint that followed found no
    // source to write to, so pins appeared only on some later event.
    return () => { m.remove(); map.current = null; setMapReady(false); };
  }, [mapOn]);

  // Repaint whenever the visible doors or any log entry change. Gated on
  // mapReady so the first paint waits for the style rather than being dropped.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;
    const src = m.getSource('doors') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: visible.map((d) => {
        const row = getRow(d.id);
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [d.lon, d.lat] },
          properties: { id: d.id, color: stripeColor(row), done: isLogged(row), unit: !!d.unit },
        };
      }),
    });
    if (!framed.current && visible.length) {
      const b = new maplibregl.LngLatBounds();
      visible.forEach((d) => b.extend([d.lon, d.lat]));
      m.fitBounds(b, { padding: 40, maxZoom: 17, duration: 0 });
      framed.current = true;
    }
  }, [visible, snapshot(), mapReady]);

  useEffect(() => {
    const src = map.current?.getSource('me') as maplibregl.GeoJSONSource | undefined;
    if (!src || !here) return;
    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [here.coords.longitude, here.coords.latitude] },
        properties: {},
      }],
    });
  }, [here, mapReady]);

  // --- near me -------------------------------------------------------------
  const nearMe = () => {
    if (!navigator.geolocation) { setToast('This browser has no location access.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      setHere(pos);
      const near = streets
        .map((s) => ({ s, km: haversineKm(pos.coords.latitude, pos.coords.longitude, s.lat, s.lon) }))
        .filter((x) => x.km <= NEAR_KM)
        .sort((a, b) => a.km - b.km)
        .slice(0, NEAR_STREETS);
      if (!near.length) { setToast('No London streets within 1.5 km of you.'); return; }
      setMapOn(true);
      open(near.map((x) => x.s.id), 'Near me', `${near.length} streets around you`);
      navigator.geolocation.watchPosition(setHere, () => {},
        { enableHighAccuracy: true, maximumAge: 15_000 });
    }, (err) => {
      setToast(err.code === 1
        ? 'Location is blocked. Allow it in your browser settings.'
        : 'Could not get a location fix. Try again in the open.');
    }, { enableHighAccuracy: true, timeout: 15_000 });
  };

  // --- the log sheet -------------------------------------------------------
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (editing && !dlg.open) dlg.showModal();
    if (!editing && dlg.open) dlg.close();
  }, [editing]);

  // The ref is the draft's source of truth and state only drives rendering.
  // Spreading the rendered `draft` inside each handler loses edits when the
  // canvasser taps sentiment, a flag and the name faster than React re-renders,
  // which at a door is the normal speed rather than the exception.
  const draftRef = useRef<CanvassRow | null>(null);
  const [draft, setDraftState] = useState<CanvassRow | null>(null);

  useEffect(() => {
    const next = editing ? { ...(getRow(editing.id) ?? blankRow(editing.id, editing.address)) } : null;
    draftRef.current = next;
    setDraftState(next);
  }, [editing]);

  const editDraft = useCallback((change: (d: CanvassRow) => CanvassRow) => {
    const current = draftRef.current;
    if (!current) return;
    const next = change(current);
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const commit = () => {
    const d = draftRef.current;
    if (d && editing) save({ ...d, address: editing.address });
    setEditing(null);
  };

  const state = getSyncState();

  // h-full rather than a viewport unit: the site applies CSS zoom to <html>, so
  // 100dvh resolves against the unzoomed layout viewport and comes up short.
  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="shrink-0 border-b border-rule bg-white px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <div className="flex items-center gap-2">
          <Link to="/admin" className="shrink-0 font-display text-[12px] font-semibold uppercase tracking-[0.14em] text-steel hover:text-ink">
            ← Admin
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-bold leading-tight">
              {selection?.label ?? 'Canvass'}
            </h1>
            <p className="truncate text-[11px] text-steel">{selection?.note ?? 'Flyer drops, London Ontario'}</p>
          </div>
          <button type="button" onClick={() => setMapOn((v) => !v)} aria-pressed={mapOn} className={mapOn ? btnOn : btn}>
            Map
          </button>
          <span
            role="status"
            aria-live="polite"
            aria-label={syncLabel()}
            title={syncLabel()}
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${SYNC_DOT[state] ?? 'bg-steel'}`}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a street"
            aria-label="Search a street"
            enterKeyHint="search"
            className={field}
          />
          <button type="button" onClick={nearMe} className={`${btn} shrink-0`}>Near me</button>
        </div>
      </header>

      {state === 'error' && (
        <p
          role="alert"
          className="shrink-0 border-b border-brand/40 bg-brand/10 px-3 py-2 text-[13px] leading-snug text-ink"
        >
          <strong className="font-semibold">Not syncing.</strong>{' '}
          {getSyncError()}{' '}
          {pendingCount() > 0
            ? `${pendingCount()} ${pendingCount() === 1 ? 'door is' : 'doors are'} saved on this device only — do not clear site data until this clears.`
            : 'Nothing is waiting to send.'}
        </p>
      )}

      {selection && !query && (
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-white px-3 py-2">
          <div className="flex overflow-hidden rounded-md border border-rule" role="group" aria-label="Side of street">
            {(['all', 'odd', 'even'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={side === s}
                onClick={() => setSide(s)}
                className={`min-h-[40px] border-l border-rule px-3 text-sm first:border-l-0 ${
                  side === s ? 'bg-ink text-white' : 'bg-white'}`}
              >
                {s === 'all' ? 'Both' : s === 'odd' ? 'Odd' : 'Even'}
              </button>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-steel">
            <input type="checkbox" checked={residentialOnly} onChange={(e) => setResidentialOnly(e.target.checked)} />
            Residential
          </label>
          <span className="ml-auto shrink-0 font-display text-xs tabular-nums text-steel">
            {doneCount}/{visible.length}
          </span>
        </div>
      )}

      <div ref={mapNode} className={`shrink-0 transition-[height] duration-[var(--dur)] ${mapOn ? 'h-[34vh]' : 'h-0'}`} />

      <main className="flex-1 overflow-y-auto pb-8">
        {query ? (
          <StreetResults matches={matches} query={query} here={here} onPick={open} />
        ) : !selection ? (
          <p className="mx-auto max-w-[34ch] px-6 py-12 text-center text-steel">
            <b className="mb-1.5 block text-lg text-ink">Pick a street to start</b>
            Search by name, or tap <strong>Near me</strong> to pull the streets around you.
            143,124 London doors are loaded.
          </p>
        ) : visible.length === 0 ? (
          <p className="mx-auto max-w-[34ch] px-6 py-12 text-center text-steel">
            <b className="mb-1.5 block text-lg text-ink">Nothing to show</b>
            No doors match this side-of-street or residential filter.
          </p>
        ) : (
          byStreet.map(([name, list]) => (
            <section key={name}>
              <h2 className="sticky top-0 z-[1] mx-auto max-w-[720px] bg-paper px-3 pb-1 pt-2.5 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-steel">
                {name} <span className="tabular-nums normal-case tracking-normal">
                  {list.filter((d) => isLogged(getRow(d.id))).length}/{list.length}
                </span>
              </h2>
              <ul className="mx-auto max-w-[720px]">
                {list.map((d) => <DoorRow key={d.id} door={d} onOpen={setEditing} />)}
              </ul>
            </section>
          ))
        )}
      </main>

      <dialog
        ref={dialogRef}
        onClose={() => setEditing(null)}
        className="m-0 max-h-full w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 sm:m-auto sm:max-w-[560px]"
      >
        {editing && draft && (
          <LogSheet
            door={editing}
            draft={draft}
            edit={editDraft}
            onSave={commit}
            onCancel={() => setEditing(null)}
            onClear={() => { save(blankRow(editing.id, editing.address)); setEditing(null); }}
          />
        )}
      </dialog>

      {toast && (
        <p role="status" aria-live="polite"
          className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-full bg-ink px-4 py-2.5 text-center text-sm text-white">
          {toast}
        </p>
      )}
    </div>
  );
}

// --- rows -------------------------------------------------------------------

function DoorRow({ door, onOpen }: { door: Door; onOpen: (d: Door) => void }) {
  const row = getRow(door.id);
  const mood = sentimentOf(row);
  const flags = CANVASS_FLAGS.filter((f) => row?.[f]);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(door)}
        aria-label={`${door.address}${door.unit ? ` unit ${door.unit}` : ''}. ${mood?.label ?? 'Not logged'}.`}
        className="flex min-h-[60px] w-full items-stretch border-b border-rule bg-white text-left active:bg-paper"
      >
        <span
          aria-hidden="true"
          className={`w-2 shrink-0 ${door.unit ? 'ml-5' : ''}`}
          style={{ background: stripeColor(row) }}
        />
        <span className="flex flex-1 items-center gap-3 px-3 py-2">
          <span className={`shrink-0 font-display font-bold leading-none tabular-nums ${
            door.unit ? 'text-lg text-steel' : 'text-[30px]'}`}>
            {door.unit || door.label}
          </span>
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-px">
            {row?.name && <span className="truncate text-sm font-semibold">{row.name}</span>}
            <span className="truncate text-[13px] text-steel">
              {door.unit && `Unit · ${door.number} · `}
              {flags.length
                ? flags.map((f) => CANVASS_FLAG_LABELS[f]).join(' · ')
                : mood?.label ?? 'Not logged'}
            </span>
          </span>
          {mood && <span className="shrink-0 text-2xl leading-none" role="img" aria-label={mood.label}>{mood.face}</span>}
        </span>
      </button>
    </li>
  );
}

function StreetResults({ matches, query, here, onPick }: {
  matches: CanvassStreet[];
  query: string;
  here: GeolocationPosition | null;
  onPick: (ids: number[], label: string, note: string) => void;
}) {
  if (!matches.length) {
    return (
      <p className="mx-auto max-w-[34ch] px-6 py-12 text-center text-steel">
        <b className="mb-1.5 block text-lg text-ink">No street matches “{query}”</b>
        Try the short form the city uses, like “Ave” or “Rd N”.
      </p>
    );
  }
  return (
    <ul className="mx-auto max-w-[720px]">
      {matches.map((s) => {
        const km = here ? haversineKm(here.coords.latitude, here.coords.longitude, s.lat, s.lon) : null;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick([s.id], s.name, 'London, Ontario')}
              className="flex min-h-[60px] w-full flex-col justify-center border-b border-rule bg-white px-3 py-2 text-left active:bg-paper"
            >
              <span className="truncate text-sm font-semibold">{s.name}</span>
              <span className="truncate text-[13px] text-steel">
                {s.residential} residential of {s.doors} door{s.doors === 1 ? '' : 's'}
                {km !== null && ` · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- the sheet --------------------------------------------------------------

function LogSheet({ door, draft, edit, onSave, onCancel, onClear }: {
  door: Door;
  draft: CanvassRow;
  edit: (change: (d: CanvassRow) => CanvassRow) => void;
  onSave: () => void;
  onCancel: () => void;
  onClear: () => void;
}) {
  const set = <K extends keyof CanvassRow>(k: K, v: CanvassRow[K]) =>
    edit((d) => ({ ...d, [k]: v }));
  const toggleFlag = (f: CanvassFlag) => edit((d) => ({ ...d, [f]: d[f] ? 0 : 1 }));

  return (
    <div className="mt-auto max-h-[92vh] overflow-y-auto rounded-t-2xl border-t border-rule bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:rounded-2xl">
      <h2 className="font-display text-sm font-semibold">
        {door.street}
        <span className="block font-display text-2xl font-bold tabular-nums">
          {door.label}{door.unit && ` · Unit ${door.unit}`}
        </span>
        <span className="mt-1 block text-xs font-normal text-steel">
          Ward {door.ward || '—'} · {door.landuse === 'R' ? 'Residential' : 'Not zoned residential'}
        </span>
      </h2>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-2 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-steel">
          How did they lean?
        </legend>
        <div className="grid grid-cols-5 gap-1.5">
          {CANVASS_SENTIMENT.map((s) => {
            const on = draft.sentiment === s.value;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={on}
                aria-label={s.label}
                onClick={() => edit((d) => ({ ...d, sentiment: d.sentiment === s.value ? null : s.value }))}
                style={on
                  ? { background: s.color, borderColor: s.color, color: '#fff' }
                  : { borderColor: `${s.color}88` }}
                className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-0.5 py-2"
              >
                <span aria-hidden="true" className="text-[26px] leading-none">{s.face}</span>
                <span className={`text-center text-[10px] leading-tight ${on ? 'text-white' : 'text-steel'}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-2 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-steel">
          What happened
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {CANVASS_FLAGS.map((f) => {
            const on = !!draft[f];
            const danger = f === 'dnc';
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => toggleFlag(f)}
                className={`min-h-[44px] rounded-full border-2 px-3.5 py-2 text-sm ${
                  on
                    ? danger
                      ? 'border-brand bg-brand text-white'
                      : 'border-ink bg-ink text-white'
                    : 'border-rule bg-white'
                }`}
              >
                {CANVASS_FLAG_LABELS[f]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-2 font-display text-[12px] font-semibold uppercase tracking-[0.08em] text-steel">
          Resident
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-steel sm:col-span-2">
            Name
            <input className={`${field} mt-1`} value={draft.name ?? ''} onChange={(e) => set('name', e.target.value || null)} />
          </label>
          <label className="block text-xs text-steel">
            Phone
            <input type="tel" className={`${field} mt-1`} value={draft.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} />
          </label>
          <label className="block text-xs text-steel">
            Email
            <input type="email" className={`${field} mt-1`} value={draft.email ?? ''} onChange={(e) => set('email', e.target.value || null)} />
          </label>
          <label className="block text-xs text-steel sm:col-span-2">
            Notes
            <textarea className={`${field} mt-1 min-h-[76px]`} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
          </label>
        </div>
      </fieldset>

      <div className="sticky bottom-0 mt-4 flex gap-2 bg-white pt-2.5">
        <button type="button" onClick={onClear} className={`${btn} shrink-0 text-brand`}>Clear</button>
        <button type="button" onClick={onCancel} className={`${btn} flex-1`}>Cancel</button>
        <button type="button" onClick={onSave} className={`${btnOn} flex-1 font-semibold`}>Save</button>
      </div>
    </div>
  );
}
