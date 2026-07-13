"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  Marker,
  useMapEvents,
  useMap,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import { UOK_CENTER, UOK_DEFAULT_ZOOM } from "./DengueMap";
import { RISK_COLORS, type ClusterData } from "@/lib/risk-engine";

// Fix Leaflet default icon in Next.js
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  discarded_container: "Discarded Container",
  water_tank: "Water Tank",
  tyre: "Tyre",
  pooling_water: "Pooling Water",
  flower_pot: "Flower Pot",
  blocked_drain: "Blocked Drain",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  reported: "#94a3b8",
  assigned: "#3b82f6",
  pending_verification: "#f59e0b",
  cleaned: "#22c55e",
};

// ──────────────────────────────────────────────────────────────────────
// FIX: MapContainer.center is STATIC — never change it dynamically.
// Use this child component with useMap() to imperatively pan/fly.
// Changing center on MapContainer directly causes _leaflet_pos crash.
// ──────────────────────────────────────────────────────────────────────
function MapViewController({ userLocation, centerTrigger }: { userLocation?: [number, number] | null; centerTrigger?: number }) {
  const map = useMap();
  useEffect(() => {
    if (userLocation) {
      // flyTo keeps Leaflet's internal state consistent — avoids the crash
      map.flyTo(userLocation, UOK_DEFAULT_ZOOM, { animate: true, duration: 1.2 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.[0], userLocation?.[1], centerTrigger]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapMoveHandler({ onCenterChange }: { onCenterChange?: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    move() {
      const center = map.getCenter();
      onCenterChange?.(center.lat, center.lng);
    },
  });
  return null;
}

interface MapInnerProps {
  clusters: ClusterData[];
  reports: Array<{
    id: string;
    location_obfuscated: { coordinates: [number, number] } | null;
    category: string;
    status: string;
    cluster_id: number | null;
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  onCenterChange?: (lat: number, lng: number) => void;
  selectedPin?: [number, number] | null;
  userLocation?: [number, number] | null;
  centerTrigger?: number;
  interactive?: boolean;
  onVolunteerClean?: (reportId: string) => void;
  mapType?: "dark" | "satellite" | "light";
}

export default function MapInner({
  clusters,
  reports,
  onMapClick,
  onCenterChange,
  selectedPin,
  userLocation,
  centerTrigger,
  interactive = true,
  onVolunteerClean,
  mapType = "dark",
}: MapInnerProps) {
  // MapContainer center is ALWAYS static (UOK_CENTER).
  // MapViewController handles dynamic repositioning safely.
  return (
    <MapContainer
      center={UOK_CENTER}
      zoom={UOK_DEFAULT_ZOOM}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      attributionControl={false}
    >
      <ZoomControl position="bottomleft" />
      {mapType === "dark" && (
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={20}
        />
      )}
      {mapType === "light" && (
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
          maxZoom={20}
        />
      )}
      {mapType === "satellite" && (
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
          maxZoom={20}
        />
      )}

      {/* Safe dynamic repositioning — does NOT touch MapContainer props */}
      <MapViewController userLocation={userLocation} centerTrigger={centerTrigger} />
      <MapClickHandler onMapClick={onMapClick} />
      <MapMoveHandler onCenterChange={onCenterChange} />

      {/* ── User GPS dot + pulse ring ── */}
      {userLocation && (
        <>
          <CircleMarker
            center={userLocation}
            radius={20}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
          <CircleMarker
            center={userLocation}
            radius={9}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#3b82f6",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#f8fafc" }}>Your location</div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {/* ── Cluster risk zones (only rendered when data exists) ── */}
      {clusters.map((cluster) => {
        if (!cluster.centroid) return null;
        const [lng, lat] = cluster.centroid.coordinates;
        const color = RISK_COLORS[cluster.risk_level].hex;

        return (
          <Circle
            key={`cluster-${cluster.id}`}
            center={[lat, lng]}
            radius={400}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.07 + Math.min(cluster.risk_score / 30, 0.2),
              weight: 1.5,
              opacity: 0.65,
              dashArray: cluster.risk_level === "critical" ? "5 4" : undefined,
            }}
          >
            <Popup>
              <div style={{ minWidth: "190px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: "0.5rem", color: "#f8fafc" }}>
                  Risk Zone — Cluster {cluster.cluster_id}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "#94a3b8", lineHeight: 1.7 }}>
                  <div>{cluster.report_count} breeding site{cluster.report_count !== 1 ? "s" : ""} reported</div>
                  {cluster.case_count > 0 && (
                    <div style={{ color: "#fca5a5" }}>{cluster.case_count} dengue case{cluster.case_count !== 1 ? "s" : ""} nearby</div>
                  )}
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span
                    style={{
                      background: `${color}22`,
                      color,
                      padding: "0.15rem 0.625rem",
                      borderRadius: "9999px",
                      fontWeight: 700,
                      fontSize: "0.6875rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {cluster.risk_level} risk · score {cluster.risk_score}
                  </span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}

      {/* ── Individual report pins with volunteer-to-clean CTA ── */}
      {reports
        .filter((r) => r.status !== "cleaned") // hide cleaned pins from public map
        .map((report) => {
          if (!report.location_obfuscated) return null;
          const [lng, lat] = report.location_obfuscated.coordinates;
          const color = STATUS_COLORS[report.status] ?? "#94a3b8";
          const isUnassigned = report.status === "reported";

          return (
            <CircleMarker
              key={`report-${report.id}`}
              center={[lat, lng]}
              radius={6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: "200px" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#f8fafc", marginBottom: "0.25rem" }}>
                    {CATEGORY_LABELS[report.category] ?? report.category}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      background: `${color}22`,
                      color,
                      borderRadius: "9999px",
                      padding: "0.1rem 0.5rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {report.status.replace(/_/g, " ")}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", marginBottom: "0.625rem" }}>
                    Location approximate · 100m precision
                  </div>

                  {/* Volunteer-to-clean CTA — only for unassigned, still-present sites */}
                  {isUnassigned && onVolunteerClean && (
                    <button
                      onClick={() => onVolunteerClean(report.id)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.5rem 0.875rem",
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.35)",
                        borderRadius: "8px",
                        color: "#86efac",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      I can clean this site
                    </button>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

      {/* ── Pin placement marker (when submitting a new report) ── */}
      {selectedPin && (
        <Marker position={selectedPin}>
          <Popup>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f8fafc" }}>
              Drop pin here — tap Submit to confirm
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
