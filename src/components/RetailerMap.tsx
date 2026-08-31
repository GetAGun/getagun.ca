import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as pmLayers, namedFlavor } from '@protomaps/basemaps';
import * as GeoJSON from 'geojson';
import {
  CATEGORY_COLORS, RANGE_ACCESS, RANGE_KINDS, SPLIT_CATEGORIES, rangeIcon,
  type Retailer, type ShootingRange,
} from '../../shared/const';
import { DENSITY_STOPS, RANGE_DENSITY_STOPS, densityByCd, loadCds } from '../lib/density';
import { currentFeel } from '../lib/feel';
import { useLang, useT } from '../lib/i18n';

maplibregl.addProtocol('pmtiles', new Protocol().tile);
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL as string;
const ASSETS_URL = 'https://protomaps.github.io/basemaps-assets';

export const MAP_FLAVORS = ['light', 'dark', 'white', 'black', 'grayscale'] as const;
export type MapFlavor = (typeof MAP_FLAVORS)[number];
export type MapTheme = MapFlavor | `${MapFlavor}-nolabels`;

export function baseStyle(theme: MapTheme = 'light'): maplibregl.StyleSpecification {
  const flavor = theme.replace('-nolabels', '') as MapFlavor;
  let layers = pmLayers('protomaps', namedFlavor(flavor), { lang: 'en' }) as maplibregl.LayerSpecification[];
  if (theme.endsWith('-nolabels')) layers = layers.filter((l) => l.type !== 'symbol');
  // Paint uncovered area (outside the Canada tile extract) as ocean instead of blank grey.
  const bg = layers.find((l) => l.id === 'background');
  const water = layers.find((l) => l.id === 'water');
  const waterColor = water?.type === 'fill' ? water.paint?.['fill-color'] : undefined;
  if (bg?.type === 'background' && typeof waterColor === 'string') {
    bg.paint = { 'background-color': waterColor };
  }
  return {
    version: 8,
    glyphs: `${ASSETS_URL}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS_URL}/sprites/v4/${flavor}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers,
  };
}

const colorExpr = [
  'match', ['get', 'category'],
  ...Object.entries(CATEGORY_COLORS).flat(),
  '#888888',
] as unknown as maplibregl.ExpressionSpecification;

function toGeoJSON(retailers: Retailer[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: retailers.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { id: r.id, category: r.category },
    })),
  };
}

// MapLibre circles are single-colour, so each split pin is a prerendered icon.
function splitPinImage(color: string): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 36; // (circle-radius 7 + stroke 2) * pixelRatio 2
  const ctx = c.getContext('2d')!;
  ctx.beginPath(); ctx.arc(18, 18, 14, Math.PI / 2, (3 * Math.PI) / 2); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.arc(18, 18, 14, -Math.PI / 2, Math.PI / 2); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(18, 18, 13.5, 0, 2 * Math.PI); // hairline keeps the white half visible
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#94a3b8'; ctx.stroke();
  ctx.beginPath(); ctx.arc(18, 18, 16, 0, 2 * Math.PI); // white ring matching circle-stroke
  ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  return ctx.getImageData(0, 0, 36, 36);
}

function ensureSplitIcons(m: maplibregl.Map) {
  for (const c of SPLIT_CATEGORIES) {
    if (!m.hasImage(`${c}-pin`)) m.addImage(`${c}-pin`, splitPinImage(CATEGORY_COLORS[c]), { pixelRatio: 2 });
  }
}

const isSplit = ['in', ['get', 'category'], ['literal', SPLIT_CATEGORIES]] as unknown as maplibregl.ExpressionSpecification;

// Read once: MapLibre bakes transition specs into the layer at creation.
const PAINT_MS = currentFeel().paintMs;

function rangesGeoJSON(ranges: ShootingRange[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ranges.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
      properties: { id: r.id, kind: r.kind, access: r.access },
    })),
  };
}

// The six range glyphs are PNGs rather than canvas drawings — one loadImage each,
// then they live in the style until it is replaced.
async function ensureRangeIcons(m: maplibregl.Map) {
  await Promise.all(
    RANGE_ACCESS.flatMap((a) => RANGE_KINDS.map(async (k) => {
      const id = rangeIcon(a, k);
      if (m.hasImage(id)) return;
      const { data } = await m.loadImage(`/icons/${id}.png`);
      if (!m.hasImage(id)) m.addImage(id, data, { pixelRatio: 2 });
    })),
  );
}

const RANGE_LAYERS = ['range-clusters', 'range-cluster-count', 'points-ranges'];

// MapLibre fixes the cluster option when the source is created, so switching it
// means rebuilding source and layers — the same dance the retailer pins do.
async function addRangeLayer(m: maplibregl.Map, data: GeoJSON.FeatureCollection, clustered: boolean) {
  await ensureRangeIcons(m);
  if (!m.getStyle()) return; // style swapped while the icons were loading
  for (const id of RANGE_LAYERS) if (m.getLayer(id)) m.removeLayer(id);
  if (m.getSource('ranges')) m.removeSource('ranges');
  m.addSource('ranges', { type: 'geojson', data, ...(clustered ? { cluster: true, clusterRadius: 45 } : {}) });
  if (clustered) {
    m.addLayer({
      id: 'range-clusters', type: 'circle', source: 'ranges',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2f3b33',
        'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 25],
        'circle-opacity': 0.88,
      },
    });
    m.addLayer({
      id: 'range-cluster-count', type: 'symbol', source: 'ranges',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12 },
      paint: { 'text-color': '#ffffff' },
    });
  }
  m.addLayer({
    id: 'points-ranges', type: 'symbol', source: 'ranges',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', 'range-', ['get', 'access'], '-', ['get', 'kind']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

const iconSizeExpr = (sel: number | null) =>
  ['case', ['==', ['get', 'id'], sel ?? -1], 12 / 7, 1] as unknown as maplibregl.ExpressionSpecification;

// Selected pin renders larger with a thicker halo. Density view shrinks pins to dots.
const sizeExprs = (sel: number | null, small = false) =>
  ({
    'circle-radius': ['case', ['==', ['get', 'id'], sel ?? -1], small ? 7 : 12, small ? 2.5 : 7],
    'circle-stroke-width': ['case', ['==', ['get', 'id'], sel ?? -1], small ? 1.5 : 3, small ? 0.75 : 2],
  }) as unknown as Record<'circle-radius' | 'circle-stroke-width', maplibregl.ExpressionSpecification>;

const fillFor = (stops: Array<[number, string]>) => [
  'step', ['coalesce', ['feature-state', 'd'], 0],
  stops[0][1],
  ...stops.slice(1).flatMap(([v, c]) => [v, c]),
] as unknown as maplibregl.ExpressionSpecification;

function addRetailerLayers(m: maplibregl.Map, data: GeoJSON.FeatureCollection, clustered: boolean, sel: number | null = null) {
  ensureSplitIcons(m);
  m.addSource('retailers', {
    type: 'geojson',
    data,
    ...(clustered ? { cluster: true, clusterRadius: 45 } : {}),
  });
  if (clustered) {
    m.addLayer({
      id: 'clusters', type: 'circle', source: 'retailers',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#1e3a5f',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
        'circle-opacity': 0.85,
      },
    });
    m.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'retailers',
      filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Medium'], 'text-size': 12 },
      paint: { 'text-color': '#ffffff' },
    });
  }
  m.addLayer({
    id: 'points', type: 'circle', source: 'retailers',
    filter: ['all', ['!', ['has', 'point_count']], ['!', isSplit]],
    paint: {
      'circle-color': colorExpr,
      'circle-stroke-color': '#ffffff',
      // Without these the density/range toggles resize every pin in one frame.
      'circle-radius-transition': { duration: PAINT_MS, delay: 0 },
      'circle-stroke-width-transition': { duration: PAINT_MS, delay: 0 },
      ...sizeExprs(sel),
    },
  });
  m.addLayer({
    id: 'points-split', type: 'symbol', source: 'retailers',
    filter: ['all', ['!', ['has', 'point_count']], isSplit],
    layout: {
      'icon-image': ['concat', ['get', 'category'], '-pin'],
      'icon-size': iconSizeExpr(sel),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

interface Props {
  retailers: Retailer[];
  onSelect: (r: Retailer) => void;
  flyTo?: { lat: number; lon: number } | null;
  clustered?: boolean;
  theme?: MapTheme;
  selectedId?: number | null;
  density?: boolean;
  ranges?: ShootingRange[];
  rangeMode?: boolean;
  rangeClustered?: boolean;
  onSelectRange?: (r: ShootingRange) => void;
}

export default function RetailerMap({
  retailers, onSelect, flyTo, clustered = true, theme = 'light', selectedId = null,
  density = false, ranges = [], rangeMode = false, rangeClustered = true, onSelectRange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const loaded = useRef(false);
  const retailersRef = useRef(retailers);
  retailersRef.current = retailers;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const clusteredRef = useRef(clustered);
  clusteredRef.current = clustered;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const densityRef = useRef(density);
  densityRef.current = density;
  const rangesRef = useRef(ranges);
  rangesRef.current = ranges;
  const rangeModeRef = useRef(rangeMode);
  rangeModeRef.current = rangeMode;
  const rangeClusteredRef = useRef(rangeClustered);
  rangeClusteredRef.current = rangeClustered;
  const onSelectRangeRef = useRef(onSelectRange);
  onSelectRangeRef.current = onSelectRange;
  const ratesRef = useRef<Map<string, number>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const { lang } = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [inView, setInView] = useState<number | null>(null);
  const updateInView = (m: maplibregl.Map) => {
    const b = m.getBounds();
    const pts = rangeModeRef.current ? rangesRef.current : retailersRef.current;
    setInView(pts.filter((r) => b.contains([r.lon, r.lat])).length);
  };

  // Shows the ranges layer, lazily creating it (and loading its icons) on first use.
  const syncRanges = (m: maplibregl.Map) => {
    if (!rangeModeRef.current) {
      if (m.getLayer('points-ranges')) m.setLayoutProperty('points-ranges', 'visibility', 'none');
      return;
    }
    addRangeLayer(m, rangesGeoJSON(rangesRef.current), rangeClusteredRef.current)
      .then(() => {
        if (!rangeModeRef.current || !m.getLayer('points-ranges')) return;
        m.setLayoutProperty('points-ranges', 'visibility', 'visible');
        m.moveLayer('points-ranges'); // stay above pins rebuilt by the cluster/theme toggles
      })
      .catch(() => {});
  };

  // Applies everything the density and range toggles change: pin sizing, split-pin icon
  // visibility, and the census-division choropleth (lazy-loaded on first use).
  const syncDensity = (m: maplibregl.Map) => {
    const on = densityRef.current;
    // Both views shrink the store pins to dots so they stop crowding what sits on top.
    const small = on || rangeModeRef.current;
    const exprs = sizeExprs(selectedIdRef.current, small);
    if (m.getLayer('points')) {
      m.setPaintProperty('points', 'circle-radius', exprs['circle-radius']);
      m.setPaintProperty('points', 'circle-stroke-width', exprs['circle-stroke-width']);
      // shrinking drops the split-pin icon layer, so those dots render here instead
      m.setFilter('points', small
        ? ['!', ['has', 'point_count']]
        : ['all', ['!', ['has', 'point_count']], ['!', isSplit]]);
    }
    if (m.getLayer('points-split')) m.setLayoutProperty('points-split', 'visibility', small ? 'none' : 'visible');
    if (!on) {
      popupRef.current?.remove();
      if (PAINT_MS && m.getLayer('cd-fill')) {
        m.setPaintProperty('cd-fill', 'fill-opacity', 0); // fade out, then hide
        window.setTimeout(() => {
          if (densityRef.current || !m.getLayer('cd-fill')) return;
          for (const id of ['cd-fill', 'cd-line']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'none');
        }, PAINT_MS);
        return;
      }
      for (const id of ['cd-fill', 'cd-line']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', 'none');
      return;
    }
    loadCds().then((cds) => {
      if (!densityRef.current || !map.current) return;
      if (!m.getSource('cds')) {
        m.addSource('cds', { type: 'geojson', data: cds as unknown as GeoJSON.FeatureCollection, promoteId: 'id' });
      }
      // insert under the basemap's labels so place names stay readable
      const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
      if (!m.getLayer('cd-fill')) {
        // Start transparent so the choropleth fades up instead of snapping in.
        m.addLayer({
          id: 'cd-fill', type: 'fill', source: 'cds',
          paint: {
            'fill-color': fillFor(rangeModeRef.current ? RANGE_DENSITY_STOPS : DENSITY_STOPS),
            'fill-opacity': PAINT_MS ? 0 : 0.55,
            'fill-opacity-transition': { duration: PAINT_MS, delay: 0 },
          },
        }, firstSymbol);
      }
      if (!m.getLayer('cd-line')) {
        m.addLayer({ id: 'cd-line', type: 'line', source: 'cds', paint: { 'line-color': 'rgba(0,0,0,0.18)', 'line-width': 0.5 } }, firstSymbol);
      }
      for (const id of ['cd-fill', 'cd-line']) m.setLayoutProperty(id, 'visibility', 'visible');
      const ranged = rangeModeRef.current;
      m.setPaintProperty('cd-fill', 'fill-color', fillFor(ranged ? RANGE_DENSITY_STOPS : DENSITY_STOPS));
      const rates = densityByCd(cds, ranged ? rangesRef.current : retailersRef.current);
      ratesRef.current = rates;
      for (const [id, d] of rates) m.setFeatureState({ source: 'cds', id }, { d });
      // Raise opacity after the states land so the fade shows finished colours.
      if (PAINT_MS) requestAnimationFrame(() => {
        if (densityRef.current && m.getLayer('cd-fill')) m.setPaintProperty('cd-fill', 'fill-opacity', 0.55);
      });
    }).catch(() => {});
  };

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current!,
      style: baseStyle(themeRef.current),
      center: [-96, 56],
      zoom: 3.2,
      // Slightly wider than the pmtiles extract bbox (-141, 41.6, -52.6, 83.2): tiles are
      // included when they intersect it, so the periphery is covered at low zoom, and the
      // water-coloured background hides the rare uncovered sliver at higher zooms.
      maxBounds: [[-150, 41], [-45, 84]],
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    // Fullscreens the map container itself, which also hides every overlay outside it.
    // Hidden automatically on browsers without the Fullscreen API (iPhone Safari).
    m.addControl(new maplibregl.FullscreenControl(), 'top-right');
    m.on('load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current, selectedIdRef.current);
      for (const layer of ['points', 'points-split']) {
        m.on('click', layer, (e) => {
          const id = e.features?.[0]?.properties?.id as number | undefined;
          const r = retailersRef.current.find((x) => x.id === id);
          if (r) {
            // The retailer card lives outside the map container — leave fullscreen to show it.
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            onSelectRef.current(r);
          }
        });
        m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = ''; });
      }
      m.on('click', 'range-clusters', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        (m.getSource('ranges') as maplibregl.GeoJSONSource)
          .getClusterExpansionZoom(f.properties!.cluster_id as number)
          .then((zoom) => m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom }))
          .catch(() => {});
      });
      for (const layer of ['range-clusters']) {
        m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer'; });
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = ''; });
      }
      m.on('click', 'clusters', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = m.getSource('retailers') as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(f.properties!.cluster_id as number).then((zoom) =>
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom }),
        ).catch(() => {});
      });
      m.on('click', 'cd-fill', (e) => {
        if (!densityRef.current) return;
        // a click on a dot selects the store — don't also pop the division box
        const pins = ['points', 'clusters'].filter((l) => m.getLayer(l));
        if (pins.length && m.queryRenderedFeatures(e.point, { layers: pins }).length) return;
        const f = e.features?.[0];
        if (!f) return;
        const { id, n } = f.properties as { id: string; n: string };
        const d = ratesRef.current.get(id) ?? 0;
        const rate = d.toLocaleString(langRef.current === 'fr' ? 'fr-CA' : 'en-CA', {
          minimumFractionDigits: 1, maximumFractionDigits: 1,
        });
        const box = document.createElement('div');
        box.className = 'text-xs leading-snug text-ink';
        const name = document.createElement('div');
        name.className = 'font-semibold';
        name.textContent = n;
        const val = document.createElement('div');
        val.textContent = `${rate} ${tRef.current(rangeModeRef.current ? 'density_popup_suffix_ranges' : 'density_popup_suffix')}`;
        box.append(name, val);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
          .setLngLat(e.lngLat).setDOMContent(box).addTo(m);
      });
      m.on('click', 'points-ranges', (e) => {
        const id = e.features?.[0]?.properties?.id as number | undefined;
        const r = rangesRef.current.find((x) => x.id === id);
        if (!r) return;
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        onSelectRangeRef.current?.(r);
      });
      m.on('mouseenter', 'points-ranges', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'points-ranges', () => { m.getCanvas().style.cursor = ''; });
      m.on('move', () => updateInView(m));
      updateInView(m);
      loaded.current = true;
      syncDensity(m);
      syncRanges(m);
    });
    map.current = m;
    return () => { loaded.current = false; m.remove(); };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current?.getSource('retailers') as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(retailers));
    if (map.current) {
      updateInView(map.current);
      if (densityRef.current) syncDensity(map.current); // shading follows the category filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailers]);

  useEffect(() => {
    if (map.current && loaded.current) syncDensity(map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, rangeMode]);

  useEffect(() => {
    if (!map.current || !loaded.current) return;
    syncRanges(map.current);
    updateInView(map.current); // the counter switches datasets with the view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranges, rangeMode, rangeClustered]);

  // Rebuild source+layers on toggle: MapLibre fixes the cluster option at source creation.
  // Event handlers survive — they're bound by layer id, and the ids are reused.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    for (const id of ['clusters', 'cluster-count', 'points', 'points-split']) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource('retailers')) m.removeSource('retailers');
    addRetailerLayers(m, toGeoJSON(retailersRef.current), clustered, selectedIdRef.current);
    syncDensity(m);
    syncRanges(m); // rebuilds the range source, which also fixes its cluster option
  }, [clustered]);

  // setStyle wipes custom sources/layers — re-add them once the new style loads.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(baseStyle(theme));
    m.once('style.load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current, selectedIdRef.current);
      syncDensity(m);
      syncRanges(m);
    });
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current || !m.getLayer('points')) return;
    const exprs = sizeExprs(selectedId, densityRef.current || rangeModeRef.current);
    m.setPaintProperty('points', 'circle-radius', exprs['circle-radius']);
    m.setPaintProperty('points', 'circle-stroke-width', exprs['circle-stroke-width']);
    if (m.getLayer('points-split')) m.setLayoutProperty('points-split', 'icon-size', iconSizeExpr(selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (flyTo) {
      const { speed, curve } = currentFeel().fly;
      map.current?.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 10, speed, curve, essential: true });
    }
  }, [flyTo]);

  // The badge lives inside the map container so it stays visible in fullscreen.
  return (
    <div ref={container} className="relative h-full w-full">
      {/* Phones: the bottom edge is taken by the filter pill and attribution, so the
          counter sits under the header instead. */}
      {inView !== null && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap border border-rule bg-paper/95 px-3 py-1 font-display text-[11px] font-semibold uppercase tracking-[0.1em] tabular-nums text-ink shadow-sm sm:bottom-3 sm:top-auto">
          {inView} {t(rangeMode ? 'ranges_in_view' : 'stores_in_view')}
        </div>
      )}
      {density && (
        <div className="pointer-events-none absolute bottom-16 left-3 z-10 border border-rule bg-paper/95 px-2.5 py-1.5 text-[11px] leading-tight text-ink shadow-sm sm:bottom-10 sm:left-auto sm:right-3">
          <div className="eyebrow mb-1">{t(rangeMode ? 'density_legend_ranges' : 'density_legend')}</div>
          <div className="flex">
            {(rangeMode ? RANGE_DENSITY_STOPS : DENSITY_STOPS).map(([, c]) => (
              <span key={c} className="h-2.5 w-4 sm:w-6" style={{ background: c }} />
            ))}
          </div>
          <div className="flex justify-between tabular-nums text-steel">
            {(rangeMode ? RANGE_DENSITY_STOPS : DENSITY_STOPS).slice(1).map(([v], i, a) => (
              <span key={v}>{i === a.length - 1 ? `${v}+` : v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
