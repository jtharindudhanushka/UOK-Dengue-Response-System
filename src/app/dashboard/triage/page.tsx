"use client";

import { useEffect, useState, useCallback } from "react";
import ClusterCard from "@/components/dashboard/ClusterCard";
import type { ClusterData } from "@/lib/risk-engine";
import { RefreshCw, Filter, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type SortOrder = "risk" | "reports" | "cases";

export default function TriagePage() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("risk");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clusters?institution=uok");
      const data = await res.json();
      setClusters(data.clusters ?? []);
      setLastRefreshed(new Date());
    } catch {
      console.error("Failed to fetch clusters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
    const interval = setInterval(fetchClusters, 60000);
    return () => clearInterval(interval);
  }, [fetchClusters]);

  const handleAssign = async (clusterId: number) => {
    setAssigning(clusterId);
    try {
      const res = await fetch(`/api/reports/${clusterId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Assigned ${data.assigned} report(s) to you. SLA timer started.`);
        await fetchClusters();
      } else {
        alert(data.error ?? "Failed to assign cluster.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setAssigning(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // Sort clusters
  const sorted = [...clusters].sort((a, b) => {
    if (sortOrder === "risk") return b.risk_score - a.risk_score;
    if (sortOrder === "reports") return b.report_count - a.report_count;
    if (sortOrder === "cases") return b.case_count - a.case_count;
    return 0;
  });

  const critical = sorted.filter((c) => c.risk_level === "critical");
  const high = sorted.filter((c) => c.risk_level === "high");
  const medium = sorted.filter((c) => c.risk_level === "medium");
  const low = sorted.filter((c) => c.risk_level === "low");

  return (
    <div
      id="triage-page"
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.375rem" }}>Triage dashboard</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
            {lastRefreshed
              ? `Last updated ${lastRefreshed.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}`
              : "Loading…"
            }
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            id="triage-refresh-btn"
            className="btn btn-secondary btn-sm"
            onClick={fetchClusters}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spinning" : ""} />
            Refresh
          </button>
          <button
            id="triage-signout-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleSignOut}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div
        id="triage-stats-strip"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.75rem",
        }}
      >
        {[
          { label: "Critical", value: critical.length, color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
          { label: "High risk", value: high.length, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
          { label: "Medium", value: medium.length, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
          { label: "Low", value: low.length, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: stat.bg,
              border: `1px solid ${stat.color}44`,
              borderRadius: "var(--radius-card)",
              padding: "0.875rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "1.5rem", color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginTop: "0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Filter size={14} color="var(--color-text-muted)" />
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginRight: "0.25rem" }}>Sort:</span>
        {(["risk", "reports", "cases"] as SortOrder[]).map((order) => (
          <button
            key={order}
            id={`sort-${order}-btn`}
            className="btn btn-sm"
            style={{
              background: sortOrder === order ? "var(--color-accent)" : "var(--color-surface-2)",
              color: sortOrder === order ? "#0f172a" : "var(--color-text-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-pill)",
              padding: "0.375rem 0.875rem",
              fontSize: "0.75rem",
              fontWeight: sortOrder === order ? 700 : 500,
            }}
            onClick={() => setSortOrder(order)}
          >
            {order === "risk" ? "Risk score" : order === "reports" ? "Site count" : "Cases"}
          </button>
        ))}
      </div>

      {/* Cluster groups */}
      {loading && clusters.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-muted)" }}>
          Loading clusters…
        </div>
      ) : sorted.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            background: "var(--color-surface)",
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>No active clusters</h2>
          <p style={{ margin: 0, fontSize: "0.875rem" }}>
            Campus is currently clear of active breeding site clusters.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {[
            { level: "critical", items: critical, label: "🚨 Critical" },
            { level: "high", items: high, label: "🔴 High risk" },
            { level: "medium", items: medium, label: "🟡 Medium" },
            { level: "low", items: low, label: "🔵 Low" },
          ]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.level}>
                <h3
                  style={{
                    margin: "0 0 0.75rem",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {group.label} ({group.items.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {group.items.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onAssign={handleAssign}
                      assigning={assigning === cluster.cluster_id}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
