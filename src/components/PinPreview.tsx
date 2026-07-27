import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { baseStyle } from './RetailerMap';

interface Props {
  lat: number;
  lon: number;
  onMove: (lat: number, lon: number) => void;
}

// Draggable pin: the pin, not the geocoder, is the source of truth for coordinates.
export default function PinPreview({ lat, lon, onMove }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const m = new maplibregl.Map({ container: container.current!, style: baseStyle(), center: [lon, lat], zoom: 14 });
    const mk = new maplibregl.Marker({ draggable: true }).setLngLat([lon, lat]).addTo(m);
    mk.on('dragend', () => {
      const p = mk.getLngLat();
      onMoveRef.current(p.lat, p.lng);
    });
    map.current = m;
    marker.current = mk;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLngLat([lon, lat]);
    map.current?.easeTo({ center: [lon, lat], zoom: 14 });
  }, [lat, lon]);

  return <div ref={container} className="h-56 w-full rounded-md border border-slate-300" />;
}
