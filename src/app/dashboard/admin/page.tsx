import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Download, Users, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface DashboardStats {
  totalReports: number;
  activeReports: number;
  cleanedReports: number;
  totalCases: number;
  activeClusters: number;
  slaBreaches: number;
  avgResolutionHours: number;
}

export default async function AdminPage() {
  const supabase = await createServiceClient();

  // Verify superadmin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "superadmin") {
    redirect("/dashboard/triage");
  }

  // Fetch dashboard data (server-side)
  const [reportsRes, casesRes, clustersRes, breachesRes] = await Promise.all([
    supabase.from("reports").select("id, status, resolved_at, assigned_at").eq("institution_id", profile.institution_id),
    supabase.from("cases").select("id, created_at").eq("institution_id", profile.institution_id),
    supabase.from("clusters").select("*").eq("institution_id", profile.institution_id).order("risk_score", { ascending: false }),
    supabase.from("sla_breaches").select("*").eq("institution_id", profile.institution_id),
  ]);

  const reports = reportsRes.data ?? [];
  const cases = casesRes.data ?? [];
  const clusters = clustersRes.data ?? [];
  const breaches = breachesRes.data ?? [];

  const stats: DashboardStats = {
    totalReports: reports.length,
    activeReports: reports.filter((r) => r.status !== "cleaned").length,
    cleanedReports: reports.filter((r) => r.status === "cleaned").length,
    totalCases: cases.length,
    activeClusters: clusters.length,
    slaBreaches: breaches.filter((b: { is_breached: boolean }) => b.is_breached).length,
    avgResolutionHours: (() => {
      const resolved = reports.filter((r) => r.status === "cleaned" && r.assigned_at && r.resolved_at);
      if (resolved.length === 0) return 0;
      const avg = resolved.reduce((sum: number, r) => {
        const hours = (new Date(r.resolved_at!).getTime() - new Date(r.assigned_at!).getTime()) / 3600000;
        return sum + hours;
      }, 0) / resolved.length;
      return Math.round(avg * 10) / 10;
    })(),
  };

  return (
    <div
      id="admin-page"
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.375rem" }}>Superadmin dashboard</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
            UOK Dengue Response System · Macro overview
          </p>
        </div>
        <a
          id="admin-export-btn"
          href="/api/export"
          download
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Download size={16} />
          Export CSV
        </a>
      </div>

      {/* Stats grid */}
      <div
        id="admin-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.875rem",
        }}
      >
        {[
          { icon: "📍", label: "Total reports", value: stats.totalReports, color: "#94a3b8" },
          { icon: "🔴", label: "Active sites", value: stats.activeReports, color: "#ef4444" },
          { icon: "✅", label: "Cleaned", value: stats.cleanedReports, color: "#22c55e" },
          { icon: "🏥", label: "Reported cases", value: stats.totalCases, color: "#a78bfa" },
          { icon: "🗺️", label: "Active clusters", value: stats.activeClusters, color: "#f59e0b" },
          { icon: "⚠️", label: "SLA breaches", value: stats.slaBreaches, color: "#dc2626" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.375rem" }}>{stat.icon}</div>
            <div style={{ fontWeight: 700, fontSize: "1.75rem", color: stat.color, lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Avg resolution */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <Clock size={28} color="var(--color-accent)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.5rem" }}>
            {stats.avgResolutionHours > 0 ? `${stats.avgResolutionHours}h` : "—"}
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            Average resolution time (from assignment to cleaned)
          </div>
        </div>
      </div>

      {/* SLA Breach table */}
      {breaches.length > 0 && (
        <div>
          <h2 style={{ margin: "0 0 0.875rem", fontSize: "1rem" }}>
            ⚠️ SLA breaches ({breaches.filter((b: { is_breached: boolean }) => b.is_breached).length})
          </h2>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Report ID", "Cluster", "Assignee", "Hours elapsed", "SLA", "Breached"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "left",
                        color: "var(--color-text-muted)",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(breaches as Array<{
                  id: string;
                  cluster_id: number;
                  assignee_name: string;
                  hours_elapsed: number;
                  sla_hours: number;
                  is_breached: boolean;
                }>).map((breach, i) => (
                  <tr
                    key={breach.id}
                    style={{
                      borderBottom: i < breaches.length - 1 ? "1px solid var(--color-border)" : "none",
                      background: breach.is_breached ? "rgba(220,38,38,0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      {breach.id?.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>#{breach.cluster_id}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{breach.assignee_name ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{breach.hours_elapsed?.toFixed(1)}h</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{breach.sla_hours}h</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span className={breach.is_breached ? "badge badge-critical" : "badge badge-cleaned"}>
                        {breach.is_breached ? "BREACHED" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student cases feed — admin only, hidden from public */}
      <div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
          🏥 Student-reported cases ({cases.length})
        </h2>
        <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem" }}>
          These are <strong style={{ color: "var(--color-text-primary)" }}>strictly private</strong> and hidden from the public map. They influence the risk engine cluster score.
        </p>

        {cases.length === 0 ? (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No cases reported.
          </div>
        ) : (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Case ID", "Reported at"].map((h) => (
                    <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cases as Array<{ id: string; created_at: string }>).map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < cases.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                    <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      {c.id.slice(0, 12)}…
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {new Date(c.created_at).toLocaleDateString("en-LK", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cluster overview */}
      <div>
        <h2 style={{ margin: "0 0 0.875rem", fontSize: "1rem" }}>
          🗺️ Active clusters
        </h2>
        {clusters.length === 0 ? (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              padding: "2rem",
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            No active clusters.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {(clusters as Array<{
              id: number;
              cluster_id: number;
              risk_level: string;
              risk_score: number;
              report_count: number;
              case_count: number;
            }>).map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--color-canvas)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-card)",
                  padding: "0.875rem",
                  borderLeft: `3px solid ${
                    c.risk_level === "critical" ? "#dc2626" :
                    c.risk_level === "high" ? "#ef4444" :
                    c.risk_level === "medium" ? "#f59e0b" : "#3b82f6"
                  }`,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Cluster #{c.cluster_id}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                  {c.report_count} sites · {c.case_count} cases · Score: {c.risk_score}
                </div>
                <span className={`badge badge-${c.risk_level}`} style={{ marginTop: "0.5rem", fontSize: "0.6875rem" }}>
                  {c.risk_level}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
