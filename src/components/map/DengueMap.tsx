"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ClusterData } from "@/lib/risk-engine";

// ── Constants ─────────────────────────────────────────────────
// University of Kelaniya, Sri Lanka
export const UOK_CENTER: [number, number] = [7.0018, 79.9001];
export const UOK_DEFAULT_ZOOM = 15;

interface DengueMapProps {
  clusters: ClusterData[];
  reports: Array<{
    id: string;
    location_obfuscated: { coordinates: [number, number] } | null;
    category: string;
    status: string;
    cluster_id: number | null;
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  selectedPin?: [number, number] | null;
  userLocation?: [number, number] | null;
  interactive?: boolean;
  onVolunteerClean?: (reportId: string) => void;
  mapType?: "dark" | "satellite" | "light";
}

// Lazy-loaded inner map (Leaflet is browser-only)
const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--color-canvas)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        fontSize: "0.875rem",
      }}
    >
      <span>Loading map…</span>
    </div>
  ),
});

export default function DengueMap(props: DengueMapProps) {
  return (
    <div
      id="dengue-map-container"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: "inherit",
        overflow: "hidden",
      }}
    >
      <MapInner {...props} />
    </div>
  );
}
