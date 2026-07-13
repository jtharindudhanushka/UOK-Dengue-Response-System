"use client";

import Link from "next/link";
import { getSlaStatus, type ClusterData, RISK_COLORS } from "@/lib/risk-engine";
import { MapPin, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import SLATimer from "./SLATimer";

interface ClusterCardProps {
  cluster: ClusterData;
  onAssign?: (clusterId: number) => void;
  assigning?: boolean;
}

const RISK_ICONS: Record<string, string> = {
  low: "🔵",
  medium: "🟡",
  high: "🔴",
  critical: "🚨",
};

export default function ClusterCard({ cluster, onAssign, assigning }: ClusterCardProps) {
  const color = RISK_COLORS[cluster.risk_level].hex;
  const riskIcon = RISK_ICONS[cluster.risk_level] ?? "⚪";

  return (
    <div
      id={`cluster-card-${cluster.cluster_id}`}
      className="card"
      style={{
        borderLeft: `3px solid ${color}`,
        transition: "background 0.15s ease",
        cursor: "default",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "1rem" }}>{riskIcon}</span>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
              Cluster #{cluster.cluster_id}
            </span>
            <span
              className={`badge badge-${cluster.risk_level}`}
              style={{ fontSize: "0.6875rem" }}
            >
              {cluster.risk_level}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-muted)",
              display: "flex",
              gap: "0.75rem",
            }}
          >
            <span>📍 {cluster.report_count} site{cluster.report_count !== 1 ? "s" : ""}</span>
            {cluster.case_count > 0 && (
              <span style={{ color: "#fca5a5" }}>🏥 {cluster.case_count} case{cluster.case_count !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* Risk score badge */}
        <div
          style={{
            background: `${color}22`,
            color,
            borderRadius: "var(--radius-sm)",
            padding: "0.25rem 0.625rem",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            fontWeight: 700,
          }}
        >
          {cluster.risk_score}
        </div>
      </div>

      {/* Risk score bar */}
      <div className="sla-bar" style={{ marginBottom: "0.75rem" }}>
        <div
          className="sla-bar-fill"
          style={{
            width: `${Math.min((cluster.risk_score / 30) * 100, 100)}%`,
            background: color,
          }}
        />
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          id={`cluster-assign-btn-${cluster.cluster_id}`}
          className="btn btn-primary btn-sm"
          style={{ flex: 1 }}
          onClick={() => onAssign?.(cluster.cluster_id)}
          disabled={assigning}
        >
          {assigning ? "Assigning…" : "Assign to me"}
        </button>
        <Link
          href={`/dashboard/resolve?cluster=${cluster.cluster_id}`}
          id={`cluster-view-btn-${cluster.cluster_id}`}
          className="btn btn-secondary btn-sm"
        >
          View
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Last updated */}
      <div
        style={{
          marginTop: "0.75rem",
          fontSize: "0.6875rem",
          color: "var(--color-text-subtle)",
        }}
      >
        Updated {new Date(cluster.last_updated).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
