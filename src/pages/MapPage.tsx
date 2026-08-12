import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_COLORS, CATEGORY_LABELS, type Category, type Retailer } from '../../shared/const';
import RetailerMap, { MAP_FLAVORS, type MapFlavor, type MapTheme } from '../components/RetailerMap';
import { getMeta, getRetailers } from '../lib/api';
import { nearest } from '../lib/geo';
import { geocode, type GeocodeHit } from '../lib/geocode';
import { useLang, useT, type StringKey } from '../lib/i18n';

// Co-op pins are split white/cherry — mirror that in the UI dots.
const swatch = (c: Category) =>
  c === 'coop'
    ? { background: `linear-gradient(90deg, #ffffff 50%, ${CATEGORY_COLORS.coop} 50%)`, boxShadow: 'inset 0 0 0 1px #cbd5e1' }
    : { background: CATEGORY_COLORS[c] };

// Switch-style toggle: instant knob slide + track colour for clear state feedback.
function Toggle({ on, onClick, label, className = '' }: { on: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm transition-colors duration-150 hover:bg-slate-50 active:scale-[.98] ${className}`}
    >
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-[#e6262a]' : 'bg-slate-300'}`}>
        <span
          className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
            on ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

const FLAVOR_KEY: Record<MapFlavor, StringKey> = {
  light: 'theme_light',
  dark: 'theme_dark',
  white: 'theme_white',
  black: 'theme_black',
  grayscale: 'theme_grayscale',
};
const THEMES: MapTheme[] = [...MAP_FLAVORS, ...MAP_FLAVORS.map((f) => `${f}-nolabels` as MapTheme)];

export default function MapPage() {
  const t = useT();
  const { lang } = useLang();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loadError, setLoadError] = useState(false);
  // ?categories=canadian-tire,sail preselects category filters; anything invalid falls back to all.
  const [active, setActive] = useState<Set<Category>>(() => {
    const param = new URLSearchParams(window.location.search).get('categories');
    const picked = param?.split(',').filter((c): c is Category => CATEGORIES.includes(c as Category));
    return new Set(picked?.length ? picked : CATEGORIES);
  });
  const [selected, setSelected] = useState<Retailer | null>(null);
  const [query, setQuery] = useState('');
  const [asOf, setAsOf] = useState('');
  // These toggles restyle the whole map, but on a phone the filter panel covers
  // most of it — collapse the panel so the change is actually visible.
  const revealMap = () => {
    if (!window.matchMedia('(min-width: 640px)').matches) setFiltersOpen(false);
  };
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searchMsg, setSearchMsg] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [clustered, setClustered] = useState(true);
  const [density, setDensity] = useState(false);
  const [theme, setTheme] = useState<MapTheme>(() => {
    const saved = localStorage.getItem('map-theme');
    return THEMES.includes(saved as MapTheme) ? (saved as MapTheme) : 'light';
  });
  useEffect(() => localStorage.setItem('map-theme', theme), [theme]);
  // Collapsed by default on small screens — the panels cover too much map on mobile.
  const [filtersOpen, setFiltersOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches);
  const [searchOpen, setSearchOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches);
  const [locating, setLocating] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();
  const searchGen = useRef(0);

  useEffect(() => {
    getRetailers().then(setRetailers).catch(() => setLoadError(true));
    getMeta().then((m) => setAsOf(m.asOf)).catch(() => {});
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.trim().length < 3) { setHits([]); return; }
    debounce.current = setTimeout(() => {
      const gen = ++searchGen.current;
      geocode(query, lang)
        .then((h) => { if (gen === searchGen.current) { setHits(h); setSearchMsg(h.length ? '' : t('geocode_none')); } })
        .catch(() => { if (gen === searchGen.current) setSearchMsg(t('geocode_error')); });
    }, 300);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lang]);

  const filtered = useMemo(() => retailers.filter((r) => active.has(r.category)), [retailers, active]);
  const counts = useMemo(() => {
    const m = {} as Record<Category, number>;
    for (const r of retailers) m[r.category] = (m[r.category] ?? 0) + 1;
    return m;
  }, [retailers]);
  const results = useMemo(
    () => (origin ? nearest(filtered, origin.lat, origin.lon, 10) : []),
    [filtered, origin],
  );

  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const nameHits = useMemo(() => {
    const q = fold(query.trim());
    if (q.length < 2) return [];
    return retailers.filter((r) => fold(r.name).includes(q)).slice(0, 5);
  }, [retailers, query]);

  const pick = (h: GeocodeHit) => {
    ++searchGen.current;
    setOrigin({ lat: h.lat, lon: h.lon, label: h.label });
    setFlyTarget({ lat: h.lat, lon: h.lon });
    setQuery(''); setHits([]); setSearchMsg('');
  };

  const pickRetailer = (r: Retailer) => {
    ++searchGen.current;
    setSelected(r);
    setFlyTarget({ lat: r.lat, lon: r.lon });
    setQuery(''); setHits([]); setSearchMsg('');
  };

  const locate = () => {
    searchGen.current++; setHits([]);
    setLocating(true); setSearchMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: t('use_my_location') });
        setFlyTarget({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => { setLocating(false); setSearchMsg(t('geoloc_error')); },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  const toggle = (c: Category) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });

  return (
    <div className="relative h-full">
      <RetailerMap retailers={filtered} onSelect={setSelected} flyTo={flyTarget} clustered={clustered && !density} theme={theme} selectedId={selected?.id ?? null} density={density} />

      {loadError && (
        <div className="absolute inset-x-0 top-0 z-20 bg-red-600 py-2 text-center text-sm text-white">
          {t('load_error')}
        </div>
      )}

      {/* Search + nearest panel — collapses to a button so the map can go fullscreen */}
      {!searchOpen && (
        <button
          onClick={() => setSearchOpen(true)}
          aria-label={t('search_placeholder')}
          className="absolute left-3 top-3 z-10 animate-[pop-in_.15s_ease-out] rounded-full bg-white p-3 shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-slate-700">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
      )}
      {searchOpen && (
      <div className="absolute left-3 top-3 z-10 flex w-80 max-w-[calc(100vw-1.5rem)] origin-top-left animate-[pop-in_.18s_ease-out] flex-col gap-2">
        <div className="rounded-lg bg-white p-2 shadow-lg">
          <div className="flex gap-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              aria-label={t('search_placeholder')}
            />
            <button
              onClick={() => setSearchOpen(false)}
              aria-label={t('close')}
              className="shrink-0 rounded-md px-2 text-slate-400 hover:text-slate-600"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m18 15-6-6-6 6" />
              </svg>
            </button>
          </div>
          {nameHits.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100">
              {nameHits.map((r) => (
                <li key={r.id}>
                  <button onClick={() => pickRetailer(r)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={swatch(r.category)} />
                    <span className="truncate">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-slate-500"> — {r.city}, {r.province}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hits.length > 0 && (
            <ul className="mt-1 divide-y divide-slate-100">
              {hits.map((h, i) => (
                <li key={i}>
                  <button onClick={() => pick(h)} className="w-full px-2 py-1.5 text-left text-sm hover:bg-slate-100">
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={locate}
            disabled={locating}
            className="mt-2 w-full rounded-md bg-slate-800 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {locating ? t('locating') : t('use_my_location')}
          </button>
          {searchMsg && <p className="mt-1 text-xs text-red-600">{searchMsg}</p>}
        </div>

        {origin && (
          <div className="max-h-[45vh] overflow-y-auto rounded-lg bg-white p-2 shadow-lg">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('nearest_title')}</h2>
              <button onClick={() => setOrigin(null)} className="text-xs text-slate-500 hover:underline">
                {t('clear')}
              </button>
            </div>
            <p className="truncate text-xs text-slate-500">{origin.label}</p>
            <ol>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r)}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="float-right text-slate-500">{r.distanceKm.toFixed(1)} km</span>
                    <br />
                    <span className="text-xs text-slate-500">{r.city}, {r.province}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      )}

      {/* Category filter */}
      <details
        open={filtersOpen}
        onToggle={(e) => setFiltersOpen((e.target as HTMLDetailsElement).open)}
        className="absolute bottom-3 left-3 z-10 max-h-[55vh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg bg-white p-2 shadow-lg open:w-[21rem]"
      >
        <summary className="cursor-pointer select-none list-none px-1 py-1 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
          <span className={`mr-1 inline-block text-xs transition-transform duration-200 ${filtersOpen ? '' : '-rotate-90'}`}>▼</span>
          {t('filters_title')}
          {retailers.length > 0 && (
            <span className="ml-1.5 inline-flex h-[18px] min-w-[1.75rem] items-center justify-center rounded-full bg-slate-800 px-1.5 align-text-bottom text-xs font-medium leading-none tabular-nums text-white">
              {retailers.length}
            </span>
          )}
        </summary>
        <div className="mt-2 grid animate-[pop-in_.18s_ease-out] grid-cols-2 gap-1.5">
          {CATEGORIES.map((c) => {
            const on = active.has(c);
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                aria-pressed={on}
                className={`relative flex items-center gap-2 rounded-md border py-2 pl-2.5 pr-9 text-left text-sm transition-all duration-150 active:scale-[.97] ${
                  on ? 'border-slate-300 bg-white' : 'border-transparent bg-slate-100 text-slate-400'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={on ? swatch(c) : { background: '#cbd5e1' }} />
                <span className="leading-tight">{CATEGORY_LABELS[c][lang]}</span>
                <span
                  className={`absolute right-1.5 top-2 inline-flex h-[18px] min-w-[1.75rem] items-center justify-center rounded-full px-1 text-[11px] font-medium leading-none tabular-nums ${
                    on ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-400'
                  }`}
                >
                  {counts[c] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-slate-200 pt-2">
          <Toggle on={clustered} onClick={() => { setClustered((v) => !v); revealMap(); }} label={t('cluster_toggle')} />
          <Toggle on={density} onClick={() => { setDensity((v) => !v); revealMap(); }} label={t('density_toggle')} className="mt-1" />
        </div>
        <label className="mt-2 block border-t border-slate-200 pt-2 text-sm">
          <span className="font-semibold text-slate-700">{t('theme_title')}</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as MapTheme)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {THEMES.map((th) => {
              const flavor = th.replace('-nolabels', '') as MapFlavor;
              return (
                <option key={th} value={th}>
                  {t(FLAVOR_KEY[flavor])}{th.endsWith('-nolabels') ? ` ${t('theme_nolabels')}` : ''}
                </option>
              );
            })}
          </select>
        </label>
      </details>

      {/* Selected retailer card */}
      {selected && (
        <div className="absolute right-3 top-3 z-10 w-80 max-w-[calc(100vw-1.5rem)] origin-top-right animate-[pop-in_.18s_ease-out] rounded-lg bg-white p-4 shadow-lg">
          <button
            onClick={() => setSelected(null)}
            className="float-right text-slate-400 hover:text-slate-600"
            aria-label={t('close')}
          >
            ✕
          </button>
          <span
            className="mb-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ background: CATEGORY_COLORS[selected.category] }}
          >
            {CATEGORY_LABELS[selected.category][lang]}
          </span>
          <h2 className="text-lg font-bold">{selected.name}</h2>
          <p className="text-sm text-slate-600">
            {selected.address}, {selected.city}, {selected.province} {selected.postal ?? ''}
          </p>
          {selected.phone && (
            <p className="mt-1 text-sm"><a className="text-blue-600 hover:underline" href={`tel:${selected.phone}`}>{selected.phone}</a></p>
          )}
          {selected.website && (
            <p className="mt-1 text-sm">
              <a className="text-blue-600 hover:underline" href={selected.website} target="_blank" rel="noopener noreferrer">
                {t('visit_website')}
              </a>
            </p>
          )}
          {selected.description && <p className="mt-2 text-sm">{selected.description}</p>}
          {asOf && (
            <p className="mt-2 text-xs text-slate-400">
              {t('data_as_of')}{' '}
              {new Date(asOf.replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
