import { useMap } from "react-leaflet";
import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet-polylinedecorator";
import { Marker, Popup } from "react-leaflet";
import type { TriptrackHaltMarker } from "@/lib/triptrack-route";
import { formatHaltDuration, formatHaltLocationLabel } from "@/lib/triptrack-route";

/** PauseCircle lucide icon in a map badge */
const HALT_FLAG_HTML = `
  <div class="halt-flag-bob" style="width:40px;height:40px;transform-origin:20px 36px;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.4));">
    <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(155deg,#7c3aed 0%,#4c1d95 100%);display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.2);">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="10" y1="15" x2="10" y2="9"/>
        <line x1="14" y1="15" x2="14" y2="9"/>
      </svg>
    </div>
  </div>`;

const haltFlagIcon = L.divIcon({
  className: "halt-flag-marker",
  html: HALT_FLAG_HTML,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -36],
});

/**
 * Renders a green route; on line hover, shows direction arrows (Leaflet.PolylineDecorator).
 */
export function TriptrackRoutePolylineLayer({
  positions,
  color = "#22c55e",
  weight = 4,
  opacity = 0.9,
}: {
  positions: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
}) {
  const map = useMap();
  const lineRef = useRef<L.Polyline | null>(null);
  const decRef = useRef<L.Layer | null>(null);
  const [hover, setHover] = useState(false);
  const posKey = useMemo(() => JSON.stringify(positions), [positions]);

  useEffect(() => {
    if (decRef.current) {
      try {
        map.removeLayer(decRef.current);
      } catch {
        /* ignore */
      }
      decRef.current = null;
    }
    if (positions.length < 2) {
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
      setHover(false);
      return;
    }
    const latlngs = positions.map((p) => L.latLng(p[0], p[1])) as L.LatLngExpression[];
    const pl = L.polyline(latlngs, { color, weight, opacity });
    pl.on("mouseover", () => setHover(true));
    pl.on("mouseout", () => setHover(false));
    pl.addTo(map);
    lineRef.current = pl;
    return () => {
      if (decRef.current) {
        try {
          map.removeLayer(decRef.current);
        } catch {
          /* ignore */
        }
        decRef.current = null;
      }
      if (lineRef.current) {
        lineRef.current.remove();
        lineRef.current = null;
      }
      setHover(false);
    };
  }, [map, posKey, color, weight, opacity]);

  useEffect(() => {
    if (decRef.current) {
      try {
        map.removeLayer(decRef.current);
      } catch {
        /* ignore */
      }
      decRef.current = null;
    }
    if (!hover || !lineRef.current || positions.length < 2) return;
    const La = L as unknown as {
      polylineDecorator: (path: L.Polyline, opts: { patterns: unknown[] }) => L.Layer;
      Symbol: { arrowHead: (o: Record<string, unknown>) => unknown };
    };
    const dec = La.polylineDecorator(lineRef.current, {
      patterns: [
        {
          offset: 22,
          repeat: 64,
          symbol: La.Symbol.arrowHead({
            pixelSize: 10,
            polygon: true,
            headAngle: 55,
            pathOptions: {
              fill: true,
              fillColor: "#15803d",
              color: "#14532d",
              weight: 1.2,
              fillOpacity: 0.95,
              stroke: true,
            },
          }),
        },
      ],
    });
    dec.addTo(map);
    decRef.current = dec;
    return () => {
      if (decRef.current) {
        try {
          map.removeLayer(decRef.current);
        } catch {
          /* ignore */
        }
        decRef.current = null;
      }
    };
  }, [hover, map, posKey, positions.length]); // re-arrow when line length changes

  return null;
}

export function HaltFlagMarkers({ halts, darkPopup }: { halts: TriptrackHaltMarker[]; darkPopup?: boolean }) {
  return (
    <>
      <style>{`
        @keyframes haltFlagBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        .halt-flag-bob { animation: haltFlagBob 2.2s ease-in-out infinite; }
        .halt-flag-marker { background: transparent; border: none; }
      `}</style>
      {halts.map((h, idx) => (
        <Marker key={`halt-${h.position[0]}-${h.position[1]}-${idx}`} position={h.position} icon={haltFlagIcon} zIndexOffset={650}>
          <Popup>
            <div className={`min-w-[160px] text-center text-sm ${darkPopup ? "text-gray-800" : "text-foreground"}`}>
              <p className="font-semibold text-violet-800">Halt</p>
              <p className={`mt-0.5 leading-snug ${darkPopup ? "text-gray-700" : "text-muted-foreground"}`}>
                {formatHaltLocationLabel(h.point)}
              </p>
              <p className={`mt-1.5 font-medium ${darkPopup ? "text-gray-900" : "text-foreground"}`}>
                {formatHaltDuration(h.durationMs)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export { haltFlagIcon };
