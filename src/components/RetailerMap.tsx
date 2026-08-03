import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as pmLayers, namedFlavor } from '@protomaps/basemaps';
import * as GeoJSON from 'geojson';
import { CATEGORY_COLORS, type Retailer } from '../../shared/const';
import { useT } from '../lib/i18n';

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

// Selected pin renders larger with a thicker halo.
const sizeExprs = (sel: number | null) =>
  ({
    'circle-radius': ['case', ['==', ['get', 'id'], sel ?? -1], 12, 7],
    'circle-stroke-width': ['case', ['==', ['get', 'id'], sel ?? -1], 3, 2],
  }) as unknown as Record<'circle-radius' | 'circle-stroke-width', maplibregl.ExpressionSpecification>;

function addRetailerLayers(m: maplibregl.Map, data: GeoJSON.FeatureCollection, clustered: boolean, sel: number | null = null) {
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
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': colorExpr,
      'circle-stroke-color': '#ffffff',
      ...sizeExprs(sel),
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
}

export default function RetailerMap({ retailers, onSelect, flyTo, clustered = true, theme = 'light', selectedId = null }: Props) {
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
  const t = useT();
  const [inView, setInView] = useState<number | null>(null);
  const updateInView = (m: maplibregl.Map) => {
    const b = m.getBounds();
    setInView(retailersRef.current.filter((r) => b.contains([r.lon, r.lat])).length);
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
      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id as number | undefined;
        const r = retailersRef.current.find((x) => x.id === id);
        if (r) {
          // The retailer card lives outside the map container — leave fullscreen to show it.
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onSelectRef.current(r);
        }
      });
      m.on('click', 'clusters', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = m.getSource('retailers') as maplibregl.GeoJSONSource;
        src.getClusterExpansionZoom(f.properties!.cluster_id as number).then((zoom) =>
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom }),
        ).catch(() => {});
      });
      m.on('mouseenter', 'points', () => { m.getCanvas().style.cursor = 'pointer'; });
      m.on('mouseleave', 'points', () => { m.getCanvas().style.cursor = ''; });
      m.on('move', () => updateInView(m));
      updateInView(m);
      loaded.current = true;
    });
    map.current = m;
    return () => { loaded.current = false; m.remove(); };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current?.getSource('retailers') as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(retailers));
    if (map.current) updateInView(map.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailers]);

  // Rebuild source+layers on toggle: MapLibre fixes the cluster option at source creation.
  // Event handlers survive — they're bound by layer id, and the ids are reused.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    for (const id of ['clusters', 'cluster-count', 'points']) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource('retailers')) m.removeSource('retailers');
    addRetailerLayers(m, toGeoJSON(retailersRef.current), clustered, selectedIdRef.current);
  }, [clustered]);

  // setStyle wipes custom sources/layers — re-add them once the new style loads.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(baseStyle(theme));
    m.once('style.load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current, selectedIdRef.current);
    });
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current || !m.getLayer('points')) return;
    const exprs = sizeExprs(selectedId);
    m.setPaintProperty('points', 'circle-radius', exprs['circle-radius']);
    m.setPaintProperty('points', 'circle-stroke-width', exprs['circle-stroke-width']);
  }, [selectedId]);

  useEffect(() => {
    if (flyTo) map.current?.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 10 });
  }, [flyTo]);

  // The badge lives inside the map container so it stays visible in fullscreen.
  return (
    <div ref={container} className="relative h-full w-full">
      {inView !== null && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs font-medium tabular-nums text-slate-700 shadow">
          {inView} {t('stores_in_view')}
        </div>
      )}
    </div>
  );
}
