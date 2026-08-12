import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as pmLayers, namedFlavor } from '@protomaps/basemaps';
import * as GeoJSON from 'geojson';
import { CATEGORY_COLORS, type Retailer } from '../../shared/const';
import { DENSITY_STOPS, densityByCd, loadCds } from '../lib/density';
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

// MapLibre circles are single-colour, so the split co-op pin is a prerendered icon.
function coopPinImage(): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 36; // (circle-radius 7 + stroke 2) * pixelRatio 2
  const ctx = c.getContext('2d')!;
  ctx.beginPath(); ctx.arc(18, 18, 14, Math.PI / 2, (3 * Math.PI) / 2); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.beginPath(); ctx.arc(18, 18, 14, -Math.PI / 2, Math.PI / 2); ctx.closePath();
  ctx.fillStyle = CATEGORY_COLORS.coop; ctx.fill();
  ctx.beginPath(); ctx.arc(18, 18, 13.5, 0, 2 * Math.PI); // hairline keeps the white half visible
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#94a3b8'; ctx.stroke();
  ctx.beginPath(); ctx.arc(18, 18, 16, 0, 2 * Math.PI); // white ring matching circle-stroke
  ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  return ctx.getImageData(0, 0, 36, 36);
}

function ensureCoopIcon(m: maplibregl.Map) {
  if (!m.hasImage('coop-pin')) m.addImage('coop-pin', coopPinImage(), { pixelRatio: 2 });
}

const iconSizeExpr = (sel: number | null) =>
  ['case', ['==', ['get', 'id'], sel ?? -1], 12 / 7, 1] as unknown as maplibregl.ExpressionSpecification;

// Selected pin renders larger with a thicker halo. Density view shrinks pins to dots.
const sizeExprs = (sel: number | null, small = false) =>
  ({
    'circle-radius': ['case', ['==', ['get', 'id'], sel ?? -1], small ? 7 : 12, small ? 2.5 : 7],
    'circle-stroke-width': ['case', ['==', ['get', 'id'], sel ?? -1], small ? 1.5 : 3, small ? 0.75 : 2],
  }) as unknown as Record<'circle-radius' | 'circle-stroke-width', maplibregl.ExpressionSpecification>;

const densityFill = [
  'step', ['coalesce', ['feature-state', 'd'], 0],
  DENSITY_STOPS[0][1],
  ...DENSITY_STOPS.slice(1).flatMap(([v, c]) => [v, c]),
] as unknown as maplibregl.ExpressionSpecification;

function addRetailerLayers(m: maplibregl.Map, data: GeoJSON.FeatureCollection, clustered: boolean, sel: number | null = null) {
  ensureCoopIcon(m);
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
    filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'category'], 'coop']],
    paint: {
      'circle-color': colorExpr,
      'circle-stroke-color': '#ffffff',
      ...sizeExprs(sel),
    },
  });
  m.addLayer({
    id: 'points-coop', type: 'symbol', source: 'retailers',
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'category'], 'coop']],
    layout: {
      'icon-image': 'coop-pin',
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
}

export default function RetailerMap({ retailers, onSelect, flyTo, clustered = true, theme = 'light', selectedId = null, density = false }: Props) {
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
    setInView(retailersRef.current.filter((r) => b.contains([r.lon, r.lat])).length);
  };

  // Applies everything the density toggle changes: pin sizing, coop icon visibility,
  // and the census-division choropleth (lazy-loaded on first use).
  const syncDensity = (m: maplibregl.Map) => {
    const on = densityRef.current;
    const exprs = sizeExprs(selectedIdRef.current, on);
    if (m.getLayer('points')) {
      m.setPaintProperty('points', 'circle-radius', exprs['circle-radius']);
      m.setPaintProperty('points', 'circle-stroke-width', exprs['circle-stroke-width']);
      // density view drops the coop icon layer, so its dots render here instead
      m.setFilter('points', on
        ? ['!', ['has', 'point_count']]
        : ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'category'], 'coop']]);
    }
    if (m.getLayer('points-coop')) m.setLayoutProperty('points-coop', 'visibility', on ? 'none' : 'visible');
    if (!on) {
      popupRef.current?.remove();
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
        m.addLayer({ id: 'cd-fill', type: 'fill', source: 'cds', paint: { 'fill-color': densityFill, 'fill-opacity': 0.55 } }, firstSymbol);
      }
      if (!m.getLayer('cd-line')) {
        m.addLayer({ id: 'cd-line', type: 'line', source: 'cds', paint: { 'line-color': 'rgba(0,0,0,0.18)', 'line-width': 0.5 } }, firstSymbol);
      }
      for (const id of ['cd-fill', 'cd-line']) m.setLayoutProperty(id, 'visibility', 'visible');
      const rates = densityByCd(cds, retailersRef.current);
      ratesRef.current = rates;
      for (const [id, d] of rates) m.setFeatureState({ source: 'cds', id }, { d });
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
      for (const layer of ['points', 'points-coop']) {
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
        box.className = 'text-xs leading-snug text-slate-700';
        const name = document.createElement('div');
        name.className = 'font-semibold';
        name.textContent = n;
        const val = document.createElement('div');
        val.textContent = `${rate} ${tRef.current('density_popup_suffix')}`;
        box.append(name, val);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, maxWidth: '260px' })
          .setLngLat(e.lngLat).setDOMContent(box).addTo(m);
      });
      m.on('move', () => updateInView(m));
      updateInView(m);
      loaded.current = true;
      syncDensity(m);
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
  }, [density]);

  // Rebuild source+layers on toggle: MapLibre fixes the cluster option at source creation.
  // Event handlers survive — they're bound by layer id, and the ids are reused.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    for (const id of ['clusters', 'cluster-count', 'points', 'points-coop']) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource('retailers')) m.removeSource('retailers');
    addRetailerLayers(m, toGeoJSON(retailersRef.current), clustered, selectedIdRef.current);
    syncDensity(m);
  }, [clustered]);

  // setStyle wipes custom sources/layers — re-add them once the new style loads.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(baseStyle(theme));
    m.once('style.load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current, selectedIdRef.current);
      syncDensity(m);
    });
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current || !m.getLayer('points')) return;
    const exprs = sizeExprs(selectedId, densityRef.current);
    m.setPaintProperty('points', 'circle-radius', exprs['circle-radius']);
    m.setPaintProperty('points', 'circle-stroke-width', exprs['circle-stroke-width']);
    if (m.getLayer('points-coop')) m.setLayoutProperty('points-coop', 'icon-size', iconSizeExpr(selectedId));
  }, [selectedId]);

  useEffect(() => {
    if (flyTo) map.current?.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 10 });
  }, [flyTo]);

  // The badge lives inside the map container so it stays visible in fullscreen.
  return (
    <div ref={container} className="relative h-full w-full">
      {/* Phones: the bottom edge is taken by the filter pill and attribution, so the
          counter sits under the header instead. */}
      {inView !== null && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs font-medium tabular-nums text-slate-700 shadow sm:bottom-3 sm:top-auto">
          {inView} {t('stores_in_view')}
        </div>
      )}
      {density && (
        <div className="pointer-events-none absolute bottom-16 left-3 z-10 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] leading-tight text-slate-700 shadow sm:bottom-10 sm:left-auto sm:right-3">
          <div className="mb-1 font-medium">{t('density_legend')}</div>
          <div className="flex">
            {DENSITY_STOPS.map(([, c]) => (
              <span key={c} className="h-2.5 w-4 sm:w-6" style={{ background: c }} />
            ))}
          </div>
          <div className="flex justify-between tabular-nums text-slate-500">
            <span>0</span><span>1</span><span>2</span><span>4</span><span>8</span><span>16+</span>
          </div>
        </div>
      )}
    </div>
  );
}
