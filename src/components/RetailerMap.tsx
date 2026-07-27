import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { layers as pmLayers, namedFlavor } from '@protomaps/basemaps';
import * as GeoJSON from 'geojson';
import { CATEGORY_COLORS, type Retailer } from '../../shared/const';

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

function addRetailerLayers(m: maplibregl.Map, data: GeoJSON.FeatureCollection, clustered: boolean) {
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
      'circle-radius': 7,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

interface Props {
  retailers: Retailer[];
  onSelect: (r: Retailer) => void;
  flyTo?: { lat: number; lon: number } | null;
  clustered?: boolean;
  theme?: MapTheme;
}

export default function RetailerMap({ retailers, onSelect, flyTo, clustered = true, theme = 'light' }: Props) {
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

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current!,
      style: baseStyle(themeRef.current),
      center: [-96, 56],
      zoom: 3.2,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    m.on('load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current);
      m.on('click', 'points', (e) => {
        const id = e.features?.[0]?.properties?.id as number | undefined;
        const r = retailersRef.current.find((x) => x.id === id);
        if (r) onSelectRef.current(r);
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
      loaded.current = true;
    });
    map.current = m;
    return () => { loaded.current = false; m.remove(); };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    (map.current?.getSource('retailers') as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(retailers));
  }, [retailers]);

  // Rebuild source+layers on toggle: MapLibre fixes the cluster option at source creation.
  // Event handlers survive — they're bound by layer id, and the ids are reused.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    for (const id of ['clusters', 'cluster-count', 'points']) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource('retailers')) m.removeSource('retailers');
    addRetailerLayers(m, toGeoJSON(retailersRef.current), clustered);
  }, [clustered]);

  // setStyle wipes custom sources/layers — re-add them once the new style loads.
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded.current) return;
    m.setStyle(baseStyle(theme));
    m.once('style.load', () => {
      addRetailerLayers(m, toGeoJSON(retailersRef.current), clusteredRef.current);
    });
  }, [theme]);

  useEffect(() => {
    if (flyTo) map.current?.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: 10 });
  }, [flyTo]);

  return <div ref={container} className="h-full w-full" />;
}
