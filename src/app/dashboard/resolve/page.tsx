"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ResolveForm from "@/components/forms/ResolveForm";
import SLATimer from "@/components/dashboard/SLATimer";
import { ArrowLeft, MapPin, Clock, Tag, Image } from "lucide-react";
import Link from "next/link";

interface Report {
  id: string;
  category: string;
  status: string;
  description: string | null;
  photo_url: string | null;
  after_photo_url: string | null;
  cluster_id: number | null;
  assigned_at: string | null;
  sla_hours: number;
  created_at: string;
  cleaned_by_student: boolean;
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

export default function ResolvePage() {
  const searchParams = useSearchParams();
  const clusterId = searchParams.get("cluster");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (!clusterId) return;

    async function fetchReports() {
      const res = await fetch(`/api/reports?cluster_id=${clusterId}`);
      const data = await res.json();
      setReports(data.reports ?? []);
      setLoading(false);
    }

    fetchReports();
  }, [clusterId]);

  const handleResolveSuccess = () => {
    setSelectedReport(null);
    // Re-fetch
    fetch(`/api/reports?cluster_id=${clusterId}`)
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []));
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>
        Loading reports…
      </div>
    );
  }

  return (
    <div
      id="resolve-page"
      style={{
        maxWidth: "700px",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Back */}
      <Link href="/dashboard/triage" id="resolve-back-btn" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}>
        <ArrowLeft size={14} />
        Back to triage
      </Link>

      <div>
        <h1 style={{ margin: 0, fontSize: "1.375rem" }}>
          Cluster #{clusterId} — Reports
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
          {reports.length} site{reports.length !== 1 ? "s" : ""} in this cluster. Mark each as cleaned after visiting.
        </p>
      </div>

      {/* Report list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {reports.map((report) => (
          <div
            key={report.id}
            id={`resolve-report-card-${report.id}`}
            className="card"
            style={{
              borderLeft: `3px solid ${
                report.status === "cleaned" ? "#22c55e" :
                report.status === "pending_verification" ? "#f59e0b" :
                report.status === "assigned" ? "#3b82f6" : "#64748b"
              }`,
            }}
          >
            {/* Report header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <Tag size={14} color="var(--color-text-muted)" />
                  <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                    {CATEGORY_LABELS[report.category] ?? report.category}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                  <Clock size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                  {new Date(report.created_at).toLocaleDateString("en-LK", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <span className={`badge badge-${report.status === "pending_verification" ? "pending" : report.status}`}>
                {report.status.replace(/_/g, " ")}
              </span>
            </div>

            {/* SLA timer if assigned */}
            {report.status === "assigned" && report.assigned_at && (
              <div style={{ marginBottom: "0.75rem" }}>
                <SLATimer assignedAt={report.assigned_at} slaHours={report.sla_hours} />
              </div>
            )}

            {/* Before photo */}
            {report.photo_url && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.25rem" }}>
                  <Image size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                  Before photo
                </div>
                <img
                  src={report.photo_url}
                  alt="Before cleanup"
                  style={{
                    width: "100%",
                    maxHeight: "160px",
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              </div>
            )}

            {report.description && (
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem" }}>{report.description}</p>
            )}

            {/* Resolve action */}
            {report.status !== "cleaned" && (
              selectedReport?.id === report.id ? (
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                  <ResolveForm
                    reportId={report.id}
                    onSuccess={handleResolveSuccess}
                  />
                </div>
              ) : (
                <button
                  id={`resolve-open-form-btn-${report.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedReport(report)}
                >
                  ✓ Mark as cleaned
                </button>
              )
            )}

            {report.status === "cleaned" && (
              <div style={{ fontSize: "0.8125rem", color: "#86efac" }}>
                ✓ Cleaned {report.after_photo_url ? "· Photo on file" : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
