"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ReportForm from "@/components/forms/ReportForm";
import CaseForm from "@/components/forms/CaseForm";
import {
  AlertTriangle, Plus, X, CheckCircle2, Crosshair, Info, Map, Layers, MapPin, Navigation
} from "lucide-react";
import { UOK_CENTER } from "@/components/map/DengueMap";
import type { ClusterData } from "@/lib/risk-engine";

const DengueMap = dynamic(() => import("@/components/map/DengueMap"), { ssr: false });

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem("uok_drs_device_id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("uok_drs_device_id", id);
  return id;
}

type SheetMode = "report" | "case" | null;
type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export default function PublicMapPage() {
  const [deviceId, setDeviceId]       = useState("");
  const [clusters, setClusters]       = useState<ClusterData[]>([]);
  const [reports, setReports]         = useState<any[]>([]);
  const [sheet, setSheet]             = useState<SheetMode>(null);
  const [selectedPin, setSelectedPin] = useState<[number, number] | null>(null);
  const [loading, setLoading]         = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [toastCounter, setToastCounter] = useState(0);
  const [volunteering, setVolunteering] = useState<string | null>(null); // report id being volunteered
  const [mapType, setMapType]         = useState<"dark" | "satellite" | "light">("dark");
  const [showMapSwitcher, setShowMapSwitcher] = useState(false);
  const [pickingLocationFor, setPickingLocationFor] = useState<SheetMode>(null);
  const [centerTrigger, setCenterTrigger] = useState(0);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  useEffect(() => { setDeviceId(getOrCreateDeviceId()); }, []);

  // Auto-request location on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleLocateMe = useCallback(() => {
    if (userLocation) {
      setCenterTrigger(prev => prev + 1);
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
          setCenterTrigger(prev => prev + 1);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [userLocation]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = toastCounter + 1;
    setToastCounter(id);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, [toastCounter]);

  const fetchData = useCallback(async () => {
    try {
      const [clustersRes, reportsRes] = await Promise.all([
        fetch("/api/clusters?institution=uok"),
        fetch("/api/reports?institution=uok"),
      ]);
      const clustersData = await clustersRes.json();
      const reportsData  = await reportsRes.json();
      setClusters(clustersData.clusters ?? []);
      setReports(reportsData.reports ?? []);
    } catch {
      console.error("Failed to fetch map data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Volunteer-to-clean handler ──────────────────────────────────
  const handleVolunteerClean = useCallback(async (reportId: string) => {
    if (volunteering) return; // prevent double-tap
    setVolunteering(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Device-ID": deviceId,
        },
        body: JSON.stringify({ volunteer_clean: true, device_id: deviceId }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("Thank you! Site marked for your cleanup — please complete it within 24 hours.", "success");
        fetchData(); // refresh map
      } else {
        addToast(data.error ?? "Could not register your cleanup. Please try again.", "error");
      }
    } catch {
      addToast("Network error. Please check your connection.", "error");
    } finally {
      setVolunteering(null);
    }
  }, [deviceId, volunteering, addToast, fetchData]);

  const handleMapClick = (lat: number, lng: number) => {
    if (sheet === "report" || sheet === "case") setSelectedPin([lat, lng]);
  };

  const closeSheet = () => { setSheet(null); setSelectedPin(null); };
  const handleReportSuccess = () => { closeSheet(); fetchData(); };

  // Active alerts only
  const criticalCount = clusters.filter((c) => c.risk_level === "critical").length;
  const highCount     = clusters.filter((c) => c.risk_level === "high").length;
  const hasAlerts     = criticalCount > 0 || highCount > 0;
  const activeCount   = reports.filter((r) => r.status !== "cleaned").length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-canvas)",
      }}
    >
      <Header />

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* ── Full-bleed map ── */}
        <div id="map-container" style={{ width: "100%", height: "100%", position: "relative" }}>
          {deviceId && (
            <DengueMap
              clusters={clusters}
              reports={reports}
              onMapClick={handleMapClick}
              onCenterChange={(lat, lng) => setMapCenter([lat, lng])}
              selectedPin={selectedPin}
              userLocation={userLocation}
              centerTrigger={centerTrigger}
              interactive={true}
              onVolunteerClean={handleVolunteerClean}
              mapType={mapType}
            />
          )}

          {/* ── Custom Map Switcher UI (Top Left, under Zoom Controls) ── */}
          <div style={{ position: "absolute", top: "5.5rem", left: "0.65rem", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
            <button
              onClick={handleLocateMe}
              style={{
                width: "36px", height: "36px", borderRadius: "var(--rounded-md)",
                background: "var(--color-surface-card)", border: "1px solid var(--color-hairline)",
                color: "var(--color-on-dark)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background 0s"
              }}
              title="Center to current location"
            >
              <Navigation size={18} />
            </button>

            <button
              onClick={() => setShowMapSwitcher(!showMapSwitcher)}
              style={{
                width: "36px", height: "36px", borderRadius: "var(--rounded-md)",
                background: "var(--color-surface-card)", border: "1px solid var(--color-hairline)",
                color: "var(--color-on-dark)", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background 0s"
              }}
            >
              <Layers size={18} />
            </button>
            {showMapSwitcher && (
              <div style={{
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-hairline)", borderRadius: "var(--rounded-lg)",
                padding: "8px", display: "flex", flexDirection: "column", gap: "4px",
                animation: "fade-in 0.2s ease"
              }}>
                <button
                  onClick={() => { setMapType("dark"); setShowMapSwitcher(false); }}
                  style={{ background: mapType === "dark" ? "var(--color-surface-elevated)" : "transparent", color: mapType === "dark" ? "var(--color-primary)" : "var(--color-on-dark)", border: "none", padding: "8px 16px", borderRadius: "var(--rounded-md)", fontSize: "13px", fontWeight: 600, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Map size={14} /> Detailed Dark
                </button>
                <button
                  onClick={() => { setMapType("satellite"); setShowMapSwitcher(false); }}
                  style={{ background: mapType === "satellite" ? "var(--color-surface-elevated)" : "transparent", color: mapType === "satellite" ? "var(--color-primary)" : "var(--color-on-dark)", border: "none", padding: "8px 16px", borderRadius: "var(--rounded-md)", fontSize: "13px", fontWeight: 600, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Map size={14} /> Satellite
                </button>
                <button
                  onClick={() => { setMapType("light"); setShowMapSwitcher(false); }}
                  style={{ background: mapType === "light" ? "var(--color-surface-elevated)" : "transparent", color: mapType === "light" ? "var(--color-primary)" : "var(--color-on-dark)", border: "none", padding: "8px 16px", borderRadius: "var(--rounded-md)", fontSize: "13px", fontWeight: 600, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Map size={14} /> Standard Light
                </button>
              </div>
            )}
          </div>

          {/* Loading spinner */}
          {loading && (
            <div
              style={{
                position: "absolute", inset: 0, zIndex: 10,
                background: "var(--color-canvas)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "44px", height: "44px", margin: "0 auto 1rem",
                    border: "3px solid var(--color-border)",
                    borderTopColor: "var(--color-accent)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                  Loading campus map…
                </p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            </div>
          )}

          {/* ── Alert pill — ONLY shown when there are high/critical zones ── */}
          {!loading && hasAlerts && (
            <div
              id="alert-pill"
              style={{
                position: "absolute",
                top: "14px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 500,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--rounded-pill)",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                fontSize: "12px",
                whiteSpace: "nowrap",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              {criticalCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#fca5a5" }}>
                  <span
                    style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: "#dc2626", flexShrink: 0,
                      boxShadow: "0 0 0 2px rgba(220,38,38,0.3)",
                    }}
                  />
                  {criticalCount} critical zone{criticalCount !== 1 ? "s" : ""}
                </span>
              )}
              {highCount > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#fda4af" }}>
                  <span
                    style={{
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: "#ef4444", flexShrink: 0,
                    }}
                  />
                  {highCount} high risk
                </span>
              )}
              <span style={{
                paddingLeft: "14px",
                borderLeft: "1px solid var(--color-hairline-strong)",
                color: "var(--color-muted)",
              }}>
                {activeCount} site{activeCount !== 1 ? "s" : ""} active
              </span>
            </div>
          )}

          {/* ── Location granted badge (top-right) ── */}
          {locationStatus === "granted" && (
            <div
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                zIndex: 500,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--rounded-pill)",
                padding: "6px 14px",
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.6875rem",
                color: "#93c5fd",
              }}
            >
              <Crosshair size={11} />
              Location active
            </div>
          )}

          {/* ── Floating action buttons (hidden in pin mode) ── */}
          {!pickingLocationFor && (
            <div
              id="map-fab-container"
              style={{
                position: "absolute",
                bottom: "1.75rem",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 500,
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
              }}
            >
              <button
                id="report-site-fab"
                className="btn btn-primary"
                onClick={() => setPickingLocationFor("report")}
                style={{ padding: "12px 24px", fontSize: "15px", boxShadow: "none" }}
              >
                <Plus size={18} strokeWidth={2.5} />
                Report a site
              </button>
              <button
                id="report-case-fab"
                className="btn btn-secondary"
                onClick={() => setPickingLocationFor("case")}
                style={{ boxShadow: "none" }}
              >
                <AlertTriangle size={15} />
                Report case
              </button>
            </div>
          )}

          {/* ── Pin Mode Overlay ── */}
          {pickingLocationFor && (
            <>
              {/* Center Targeting Pin */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -100%)",
                  zIndex: 1000,
                  pointerEvents: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <MapPin size={42} color="var(--color-primary)" fill="rgba(224, 255, 33, 0.2)" strokeWidth={2} />
                <div style={{ width: "6px", height: "6px", background: "var(--color-primary)", borderRadius: "50%", marginTop: "-2px" }} />
              </div>

              {/* Confirm Bottom Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: "1.75rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 1000,
                  width: "90%",
                  maxWidth: "400px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ textAlign: "center", background: "rgba(10,10,10,0.8)", backdropFilter: "blur(4px)", padding: "8px 16px", borderRadius: "100px", color: "white", fontSize: "14px", alignSelf: "center", border: "1px solid var(--color-hairline)" }}>
                  Drag map to pinpoint location
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setPickingLocationFor(null)}
                    style={{ flex: 1, padding: "12px" }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedPin(mapCenter || userLocation || UOK_CENTER);
                      setSheet(pickingLocationFor);
                      setPickingLocationFor(null);
                    }}
                    style={{ flex: 2, padding: "12px" }}
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Info legend (Top Right, below active location pill) ── */}
          <div
            style={{
              position: "absolute",
              top: userLocation ? "60px" : "14px",
              right: "14px",
              zIndex: 500,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--rounded-md)",
              padding: "10px 14px",
              fontSize: "11px",
              color: "var(--color-muted)",
              lineHeight: 1.8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
              Reported site
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
              Assigned (team en route)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
              Awaiting verification
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom sheet ── */}
      {sheet && (
        <>
          <div className="bottom-sheet-overlay" onClick={closeSheet} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div
                  style={{
                    width: "32px", height: "32px", borderRadius: "var(--rounded-md)",
                    background: sheet === "report" ? "var(--color-primary)" : "var(--color-surface-elevated)",
                    border: `1px solid ${sheet === "report" ? "var(--color-primary)" : "var(--color-hairline-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {sheet === "report"
                    ? <Plus size={18} color="var(--color-on-primary)" strokeWidth={3} />
                    : <AlertTriangle size={16} color="var(--color-accent-rose)" />
                  }
                </div>
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, letterSpacing: "-0.5px" }}>
                  {sheet === "report" ? "Report a breeding site" : "Report suspected dengue case"}
                </h2>
              </div>
              <button
                id="close-sheet-btn"
                className="btn btn-ghost btn-sm"
                onClick={closeSheet}
                style={{ padding: "0.5rem" }}
              >
                <X size={18} />
              </button>
            </div>

            {sheet === "report" && deviceId && (
              <ReportForm
                deviceId={deviceId}
                userLocation={userLocation}
                selectedPin={selectedPin}
                onSuccess={handleReportSuccess}
                onClose={closeSheet}
              />
            )}
            {sheet === "case" && deviceId && (
              <CaseForm
                deviceId={deviceId}
                userLocation={userLocation}
                selectedPin={selectedPin}
                onSuccess={closeSheet}
                onClose={closeSheet}
              />
            )}
          </div>
        </>
      )}

      {/* ── Toast notifications ── */}
      <div
        style={{
          position: "fixed",
          bottom: "5.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          pointerEvents: "none",
          width: "min(calc(100vw - 2rem), 420px)",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: toast.type === "success"
                ? "rgba(15,23,42,0.95)"
                : toast.type === "error"
                ? "rgba(30,15,15,0.95)"
                : "rgba(15,23,42,0.95)",
              border: `1px solid ${
                toast.type === "success" ? "rgba(34,197,94,0.35)"
                : toast.type === "error" ? "rgba(239,68,68,0.35)"
                : "var(--color-border)"
              }`,
              borderRadius: "var(--radius-card)",
              padding: "0.875rem 1rem",
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              animation: "slide-up 0.25s ease",
            }}
          >
            {toast.type === "success" && <CheckCircle2 size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: "1px" }} />}
            {toast.type === "error"   && <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "1px" }} />}
            {toast.type === "info"    && <Info size={18} color="#60a5fa" style={{ flexShrink: 0, marginTop: "1px" }} />}
            <span style={{ fontSize: "0.8125rem", lineHeight: 1.5 }}>{toast.message}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 768px) {
          #map-fab-container {
            left: auto !important;
            transform: none !important;
            right: 2rem;
            flex-direction: column;
            align-items: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
