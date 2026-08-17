import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PROVINCES, RANGE_ACCESS, RANGE_ACCESS_LABELS, RANGE_KINDS, RANGE_KIND_LABELS, rangeIcon,
  type Province, type RangeAccess, type RangeKind, type ShootingRange,
} from '../../shared/const';
import PinPreview from '../components/PinPreview';
import { admin, type RangeForm } from '../lib/api';
import { parseAddress } from '../lib/address';
import { geocode, reverseGeocode } from '../lib/geocode';
import { haversineKm } from '../lib/geo';

const EMPTY: RangeForm = {
  name: '', address: '', city: '', province: 'ON', postal: null, lat: 0, lon: 0,
  phone: null, website: null, description: null, kind: 'outdoor', access: 'public',
};
const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export default function AdminRanges() {
  const [ranges, setRanges] = useState<ShootingRange[]>([]);
  const [form, setForm] = useState<RangeForm>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [coordText, setCoordText] = useState('');
  const [addrText, setAddrText] = useState('');
  const [gmapsText, setGmapsText] = useState('');
  const [listQuery, setListQuery] = useState('');

  const reload = () => admin.getRanges().then(setRanges).catch(() => setMsg('Failed to load ranges (is the ranges table created?)'));
  useEffect(() => { reload(); }, []);

  const set = <K extends keyof RangeForm>(k: K, v: RangeForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Same 100 m duplicate warning the retailer form uses.
  const nearby = useMemo(() => {
    if (!form.lat || !form.lon) return [];
    return ranges.filter((r) => r.id !== editingId && haversineKm(form.lat, form.lon, r.lat, r.lon) <= 0.1);
  }, [ranges, form.lat, form.lon, editingId]);

  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const listed = useMemo(() => {
    const q = fold(listQuery.trim());
    const rows = q ? ranges.filter((r) => fold([r.name, r.city, r.province, r.address].join(' ')).includes(q)) : ranges;
    const cmp = new Intl.Collator('en', { sensitivity: 'base' }).compare;
    return [...rows].sort((a, b) => cmp(a.name, b.name));
  }, [ranges, listQuery]);

  const applyAddress = () => {
    setMsg('');
    if (!addrText.trim()) { setMsg('Paste a full address first (e.g. 22789 Hagerty Rd, Newbury, ON N0L 1Z0)'); return; }
    const p = parseAddress(addrText);
    if (!p) { setMsg('Could not read a street address from that'); return; }
    setForm((f) => ({
      ...f,
      address: p.address,
      city: p.city ?? f.city,
      province: p.province ?? f.province,
      postal: p.postal ?? f.postal,
    }));
    setAddrText('');
  };

  const applyCoords = () => {
    setMsg('');
    const nums = (coordText.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    if (nums.length < 2) { setMsg('Paste coordinates as "lat, lon" (e.g. 45.4236, -75.7009)'); return; }
    const [lat, lon] = nums;
    if (lat < 41.6 || lat > 83.2 || lon < -141.1 || lon > -52.5) {
      setMsg('Those coordinates are outside Canada — check the order (lat first, then lon)');
      return;
    }
    set('lat', lat); set('lon', lon);
    setCoordText('');
  };

  const runGeocode = async () => {
    setMsg('');
    const q = [form.address, form.city, form.province].filter(Boolean).join(', ');
    if (!q) { setMsg('Fill address and city first'); return; }
    try {
      const hits = await geocode(q, 'en');
      if (!hits.length) { setMsg('Geocoder found nothing — set the pin by hand'); return; }
      set('lat', hits[0].lat); set('lon', hits[0].lon);
    } catch {
      setMsg('Geocoding failed — set the pin by hand');
    }
  };

  const importGmaps = async () => {
    setMsg('');
    const link = gmapsText.trim();
    if (!link) { setMsg('Paste a Google Maps link first'); return; }
    setMsg('Importing from Google Maps…');
    try {
      const g = await admin.resolveGmaps(link);
      if (g.lat === null || g.lon === null) {
        setMsg(g.name ? `Got the name ("${g.name}") but no coordinates — fill the address and geocode instead` : 'Could not read that link');
        if (g.name) setForm((f) => ({ ...f, name: g.name! }));
        return;
      }
      const addr = await reverseGeocode(g.lat, g.lon).catch(() => null);
      setForm((f) => ({
        ...f,
        name: g.name ?? f.name,
        lat: g.lat!, lon: g.lon!,
        address: addr?.address || f.address,
        city: addr?.city || f.city,
        province: (addr?.province as Province | null) ?? f.province,
        postal: addr?.postal ?? f.postal,
      }));
      setGmapsText('');
      setMsg('Imported name and pin from Google; address is reverse-geocoded — verify it.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (!form.lat || !form.lon) { setMsg('Geocode or paste coordinates before saving'); return; }
    try {
      if (editingId === null) await admin.createRange(form);
      else await admin.updateRange(editingId, form);
      setForm({ ...EMPTY, kind: form.kind, access: form.access }); // batch entry keeps the classifier
      setEditingId(null);
      reload();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const edit = (r: ShootingRange) => {
    const { id, ...rest } = r;
    setForm(rest); setEditingId(id);
    window.scrollTo({ top: 0 });
  };

  const remove = async (r: ShootingRange) => {
    if (!confirm(`Delete "${r.name}" permanently?`)) return;
    try { await admin.deleteRange(r.id); reload(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Delete failed'); }
  };

  return (
    <div>
      {msg && <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-sm">{msg}</p>}

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{editingId === null ? 'Add range' : `Edit #${editingId}`}</h2>
        <label className="text-sm">Name<input value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} className={field} /></label>

        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm">Import from Google Maps
            <input
              value={gmapsText}
              onChange={(e) => setGmapsText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); importGmaps(); } }}
              placeholder="https://maps.app.goo.gl/…"
              className={field}
            />
          </label>
          <button type="button" onClick={importGmaps} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">Import</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Type
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as RangeKind)} className={field}>
              {RANGE_KINDS.map((k) => <option key={k} value={k}>{RANGE_KIND_LABELS[k].en}</option>)}
            </select>
          </label>
          <label className="text-sm">Access
            <select value={form.access} onChange={(e) => set('access', e.target.value as RangeAccess)} className={field}>
              {RANGE_ACCESS.map((a) => <option key={a} value={a}>{RANGE_ACCESS_LABELS[a].en}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <img src={`/icons/${rangeIcon(form.access, form.kind)}.png`} alt="" className="h-6 w-6 object-contain" />
          Map icon for this combination
        </div>

        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm">Paste full address
            <input
              value={addrText}
              onChange={(e) => setAddrText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyAddress(); } }}
              placeholder="22789 Hagerty Rd, Newbury, ON N0L 1Z0"
              className={field}
            />
          </label>
          <button type="button" onClick={applyAddress} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">
            Autofill
          </button>
        </div>

        <label className="text-sm">Address<input value={form.address} onChange={(e) => set('address', e.target.value)} required maxLength={200} className={field} /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">City<input value={form.city} onChange={(e) => set('city', e.target.value)} required maxLength={80} className={field} /></label>
          <label className="text-sm">Province
            <select value={form.province} onChange={(e) => set('province', e.target.value as Province)} className={field}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-sm">Postal<input value={form.postal ?? ''} onChange={(e) => set('postal', e.target.value || null)} maxLength={10} className={field} /></label>
        </div>

        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm">Paste coordinates
            <input
              value={coordText}
              onChange={(e) => setCoordText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoords(); } }}
              placeholder="45.4236, -75.7009"
              className={field}
            />
          </label>
          <button type="button" onClick={applyCoords} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">Apply</button>
          <button type="button" onClick={runGeocode} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">Geocode address</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Lat<input type="number" step="any" value={form.lat || ''} onChange={(e) => set('lat', Number(e.target.value))} required className={field} /></label>
          <label className="text-sm">Lon<input type="number" step="any" value={form.lon || ''} onChange={(e) => set('lon', Number(e.target.value))} required className={field} /></label>
        </div>
        {nearby.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Within 100 m of {nearby.length === 1 ? 'an existing range' : `${nearby.length} existing ranges`}:{' '}
            {nearby.map((r) => `${r.name} (${r.address}, ${r.city})`).join('; ')}. Make sure this isn't a duplicate.
          </div>
        )}
        {form.lat !== 0 && (
          <PinPreview lat={form.lat} lon={form.lon} onMove={(lat, lon) => { set('lat', lat); set('lon', lon); }} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Phone<input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} maxLength={30} className={field} /></label>
          <label className="text-sm">Website<input value={form.website ?? ''} onChange={(e) => set('website', e.target.value || null)} maxLength={200} placeholder="https://…" className={field} /></label>
        </div>
        <label className="text-sm">Description<textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value || null)} maxLength={1000} rows={2} className={field} /></label>

        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700">
            {editingId === null ? 'Add range' : 'Save changes'}
          </button>
          {editingId !== null && (
            <button type="button" onClick={() => { setForm(EMPTY); setEditingId(null); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Ranges ({ranges.length})</h2>
      <input
        value={listQuery}
        onChange={(e) => setListQuery(e.target.value)}
        placeholder="Filter by name, city, province…"
        className={`${field} mt-2`}
      />
      <ul className="mt-2 divide-y divide-slate-200">
        {listed.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <img src={`/icons/${rangeIcon(r.access, r.kind)}.png`} alt="" className="h-5 w-5 shrink-0 object-contain" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{r.name}</span>
              <span className="text-slate-500"> — {r.city}, {r.province} · {RANGE_KIND_LABELS[r.kind].en}, {RANGE_ACCESS_LABELS[r.access].en}</span>
            </span>
            <button onClick={() => edit(r)} className="shrink-0 text-blue-600 hover:underline">Edit</button>
            <button onClick={() => remove(r)} className="shrink-0 text-red-600 hover:underline">Delete</button>
          </li>
        ))}
        {!listed.length && <li className="py-2 text-sm text-slate-500">No ranges yet.</li>}
      </ul>
    </div>
  );
}
