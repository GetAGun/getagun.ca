import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CATEGORIES, CATEGORY_LABELS, PROVINCES, type Category, type Province, type Retailer, type Suggestion } from '../../shared/const';
import PinPreview from '../components/PinPreview';
import AdminFaq from './AdminFaq';
import { admin, type RetailerForm } from '../lib/api';
import { geocode, reverseGeocode } from '../lib/geocode';
import { haversineKm } from '../lib/geo';

const EMPTY: RetailerForm = {
  name: '', address: '', city: '', province: 'ON', postal: null, lat: 0, lon: 0,
  phone: null, website: null, description: null, category: 'independent',
};

// Blank form defaulting to the last-saved category — batch entry of a chain shouldn't
// require re-picking the category every store.
const blankForm = (): RetailerForm => {
  const saved = localStorage.getItem('last-category') as Category | null;
  return { ...EMPTY, category: saved && CATEGORIES.includes(saved) ? saved : 'independent' };
};

export default function AdminPage() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [form, setForm] = useState<RetailerForm>(blankForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fromSuggestion, setFromSuggestion] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'retailers' | 'faq'>('retailers');
  const [coordText, setCoordText] = useState('');
  const [addrText, setAddrText] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [listSort, setListSort] = useState<'name' | 'city' | 'province' | 'category'>('name');
  const [gmapsText, setGmapsText] = useState('');
  // Warn (don't block) when the pin sits within 100 m of an existing retailer — likely a duplicate.
  const nearbyExisting = useMemo(() => {
    if (!form.lat || !form.lon) return [];
    return retailers.filter(
      (r) => r.id !== editingId && haversineKm(form.lat, form.lon, r.lat, r.lon) <= 0.1,
    );
  }, [retailers, form.lat, form.lon, editingId]);
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const listedRetailers = useMemo(() => {
    const q = fold(listQuery.trim());
    const matched = q
      ? retailers.filter((r) =>
          fold([r.name, r.city, r.address, r.province, CATEGORY_LABELS[r.category].en].join(' ')).includes(q))
      : retailers;
    const cmp = new Intl.Collator('en', { sensitivity: 'base' }).compare;
    const keys: Record<typeof listSort, (r: Retailer) => string[]> = {
      name: (r) => [r.name],
      city: (r) => [r.city, r.name],
      province: (r) => [r.province, r.city, r.name],
      category: (r) => [CATEGORY_LABELS[r.category].en, r.name],
    };
    const key = keys[listSort];
    return [...matched].sort((a, b) => {
      const ka = key(a), kb = key(b);
      for (let i = 0; i < ka.length; i++) {
        const d = cmp(ka[i], kb[i]);
        if (d) return d;
      }
      return 0;
    });
  }, [retailers, listQuery, listSort]);

  const reload = () => {
    admin.getRetailers().then(setRetailers).catch(() => setMsg('Failed to load retailers'));
    admin.getSuggestions().then(setSuggestions).catch(() => setMsg('Failed to load suggestions (are you signed in to Access?)'));
  };
  useEffect(reload, []);

  const set = <K extends keyof RetailerForm>(k: K, v: RetailerForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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

  const TOLL_FREE = new Set(['800', '833', '844', '855', '866', '877', '888']);
  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    if (ten.length !== 10) return raw; // not a plain NA number — leave as typed
    const [a, b, c] = [ten.slice(0, 3), ten.slice(3, 6), ten.slice(6)];
    return TOLL_FREE.has(a) ? `1-(${a})-${b}-${c}` : `(${a}) ${b}-${c}`;
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
      setMsg('Imported name and pin from Google; address is reverse-geocoded — verify it. Phone and website need manual entry.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const applyAddress = () => {
    setMsg('');
    let s = addrText.trim();
    if (!s) { setMsg('Paste a full address first (e.g. 22789 Hagerty Rd, Newbury, ON N0L 1Z0)'); return; }
    const postalM = s.match(/[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d/);
    const postal = postalM ? postalM[0].toUpperCase().replace(/\s+/, '').replace(/^(.{3})/, '$1 ') : null;
    if (postalM) s = s.replace(postalM[0], '');
    const provM = s.toUpperCase().match(/(?:^|[\s,])(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)(?=$|[\s,.])/);
    if (provM) {
      const i = s.toUpperCase().lastIndexOf(provM[1]);
      s = s.slice(0, i) + s.slice(i + 2);
    }
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    if (!parts.length) { setMsg('Could not read a street address from that'); return; }
    setForm((f) => ({
      ...f,
      address: parts[0],
      city: parts[1] ?? f.city,
      province: (provM ? provM[1] : f.province) as Province,
      postal: postal ?? f.postal,
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    if (!form.lat || !form.lon) { setMsg('Geocode or place the pin before saving'); return; }
    try {
      if (editingId === null) {
        const suggestionId = fromSuggestion;
        await admin.createRetailer(form);
        localStorage.setItem('last-category', form.category);
        setForm(blankForm()); setEditingId(null); setFromSuggestion(null);
        reload();
        if (suggestionId !== null) {
          try {
            await admin.setSuggestionStatus(suggestionId, 'approved');
            reload();
          } catch {
            setMsg('Retailer saved, but marking the suggestion approved failed — approve or reject it manually below.');
            return;
          }
        }
        setMsg('Saved.');
      } else {
        await admin.updateRetailer(editingId, form);
        localStorage.setItem('last-category', form.category);
        setForm(blankForm()); setEditingId(null); setFromSuggestion(null);
        reload();
        setMsg('Saved.');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const edit = (r: Retailer) => {
    const { id, ...rest } = r;
    setForm(rest); setEditingId(id); setFromSuggestion(null);
    window.scrollTo({ top: 0 });
  };

  const remove = async (r: Retailer) => {
    if (!confirm(`Delete "${r.name}" permanently?`)) return;
    try { await admin.deleteRetailer(r.id); reload(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const loadSuggestion = (s: Suggestion) => {
    setForm({
      ...blankForm(),
      name: s.name,
      address: s.address ?? '',
      city: s.city ?? '',
      province: (PROVINCES.includes(s.province as never) ? s.province : 'ON') as Province,
      website: s.website,
    });
    setEditingId(null);
    setFromSuggestion(s.id);
    window.scrollTo({ top: 0 });
  };

  const reject = async (s: Suggestion) => {
    try { await admin.setSuggestionStatus(s.id, 'rejected'); reload(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Reject failed'); }
  };

  // For update/feedback suggestions: mark handled (same status as an approved new-retailer suggestion)
  const resolveSuggestion = async (s: Suggestion) => {
    try { await admin.setSuggestionStatus(s.id, 'approved'); reload(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Resolve failed'); }
  };

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
  const tabBtn = (active: boolean) =>
    `rounded-md px-4 py-2 text-sm font-medium ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200'}`;
  return (
    <div className="mx-auto max-w-3xl overflow-y-auto p-6 pb-12">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="ml-4 flex gap-2">
          <button onClick={() => setTab('retailers')} className={tabBtn(tab === 'retailers')}>Retailers</button>
          <button onClick={() => setTab('faq')} className={tabBtn(tab === 'faq')}>FAQ</button>
        </div>
      </div>
      {tab === 'faq' && <div className="mt-4"><AdminFaq /></div>}
      <div className={tab === 'retailers' ? '' : 'hidden'}>
      {msg && <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-sm">{msg}</p>}

      <form onSubmit={save} className="mt-4 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{editingId === null ? 'Add retailer' : `Edit #${editingId}`}</h2>
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
          <button type="button" onClick={importGmaps} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">
            Import
          </button>
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
        <label className="text-sm">Street address<input value={form.address} onChange={(e) => set('address', e.target.value)} required maxLength={200} className={field} /></label>
        <div className="flex gap-3">
          <label className="flex-1 text-sm">City<input value={form.city} onChange={(e) => set('city', e.target.value)} required maxLength={80} className={field} /></label>
          <label className="text-sm">Province
            <select value={form.province} onChange={(e) => set('province', e.target.value as Province)} className={field}>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-sm">Postal<input value={form.postal ?? ''} onChange={(e) => set('postal', e.target.value || null)} maxLength={10} className={field} /></label>
        </div>
        <div className="flex gap-3">
          <label className="flex-1 text-sm">Category
            <select value={form.category} onChange={(e) => set('category', e.target.value as Category)} className={field}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c].en}</option>)}
            </select>
          </label>
          <label className="flex-1 text-sm">Phone<input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || null)} onBlur={() => { if (form.phone) set('phone', formatPhone(form.phone)); }} maxLength={30} className={field} /></label>
        </div>
        <label className="text-sm">Website<input value={form.website ?? ''} onChange={(e) => set('website', e.target.value || null)} maxLength={200} placeholder="https://" className={field} /></label>
        <label className="text-sm">Description<textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value || null)} maxLength={1000} rows={3} className={field} /></label>

        <div className="flex items-end gap-3">
          <button type="button" onClick={runGeocode} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">
            Geocode address
          </button>
          <input
            value={coordText}
            onChange={(e) => setCoordText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoords(); } }}
            placeholder="or paste: 45.4236, -75.7009"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
            aria-label="Paste coordinates (lat, lon)"
          />
          <button type="button" onClick={applyCoords} className="rounded-md bg-slate-200 px-3 py-2 text-sm hover:bg-slate-300">
            Set coordinates
          </button>
          <span className="text-xs text-slate-500">lat {form.lat.toFixed(5)}, lon {form.lon.toFixed(5)}</span>
        </div>
        {nearbyExisting.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Within 100 m of {nearbyExisting.length === 1 ? 'an existing retailer' : `${nearbyExisting.length} existing retailers`}:{' '}
            {nearbyExisting.map((r) => `${r.name} (${r.address}, ${r.city})`).join('; ')}. Make sure this isn't a duplicate.
          </div>
        )}
        {form.lat !== 0 && (
          <PinPreview lat={form.lat} lon={form.lon} onMove={(lat, lon) => { set('lat', lat); set('lon', lon); }} />
        )}

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            {editingId === null ? 'Add retailer' : 'Save changes'}
          </button>
          {(editingId !== null || fromSuggestion !== null) && (
            <button type="button" onClick={() => { setForm(blankForm()); setEditingId(null); setFromSuggestion(null); }} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Pending suggestions ({suggestions.length})</h2>
      <ul className="mt-2 divide-y divide-slate-200">
        {suggestions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              s.kind === 'feedback' ? 'bg-purple-100 text-purple-800' : s.kind === 'update' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
            }`}>{s.kind === 'feedback' ? 'Feedback' : s.kind === 'update' ? 'Update' : 'New'}</span>
            <div className="flex-1">
              <span className="font-medium">{s.name}</span>
              {s.kind !== 'feedback' && (
                <span className="text-slate-500"> — {[s.address, s.city, s.province].filter(Boolean).join(', ') || 'no location given'}</span>
              )}
              {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
            </div>
            {s.kind === 'new' && (
              <button onClick={() => loadSuggestion(s)} className="rounded bg-green-100 px-2 py-1 text-xs hover:bg-green-200">Load into form</button>
            )}
            {s.kind !== 'new' && (
              <button onClick={() => resolveSuggestion(s)} className="rounded bg-green-100 px-2 py-1 text-xs hover:bg-green-200">Resolve</button>
            )}
            <button onClick={() => reject(s)} className="rounded bg-red-100 px-2 py-1 text-xs hover:bg-red-200">Reject</button>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Retailers ({retailers.length})</h2>
      <div className="mt-2 flex gap-2">
        <input
          value={listQuery}
          onChange={(e) => setListQuery(e.target.value)}
          placeholder="Search by name, city, address, province or category…"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          aria-label="Search retailers"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
          Sort
          <select
            value={listSort}
            onChange={(e) => setListSort(e.target.value as typeof listSort)}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="name">Name</option>
            <option value="city">City/town</option>
            <option value="province">Province</option>
            <option value="category">Category</option>
          </select>
        </label>
      </div>
      {listQuery && (
        <p className="mt-1 text-xs text-slate-500">
          {listedRetailers.length ? `${listedRetailers.length} match${listedRetailers.length === 1 ? '' : 'es'}` : 'No matches — not added yet'}
        </p>
      )}
      <ul className="mt-2 divide-y divide-slate-200">
        {listedRetailers.map((r) => (
          <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex-1">
              <span className="font-medium">{r.name}</span>
              <span className="text-slate-500"> — {r.city}, {r.province} · {CATEGORY_LABELS[r.category].en}</span>
            </div>
            <button onClick={() => edit(r)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">Edit</button>
            <button onClick={() => remove(r)} className="rounded bg-red-100 px-2 py-1 text-xs hover:bg-red-200">Delete</button>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
