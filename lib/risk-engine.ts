/**
 * Risk Engine — UOK Dengue Response System
 *
 * This module mirrors the SQL risk score function for client-side preview
 * and provides TypeScript types for cluster risk data.
 *
 * Formula:
 *   Risk = Σ(severity_weight[category] × time_decay(created_at))
 *          + (case_proximity_multiplier × nearby_case_count)
 *
 * Severity weights:
 *   tyre = 3.0, water_tank = 2.5, pooling_water = 2.0,
 *   discarded_container = 1.8, flower_pot = 1.5, blocked_drain = 1.2, other = 1.0
 *
 * Time decay: e^(-0.1 × days_since_report)
 * Case proximity: +2.0 per confirmed case within 400m of cluster centroid
 */

export type ReportCategory =
  | "discarded_container"
  | "water_tank"
  | "tyre"
  | "pooling_water"
  | "flower_pot"
  | "blocked_drain"
  | "other";

export type ReportStatus =
  | "reported"
  | "assigned"
  | "pending_verification"
  | "cleaned";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ClusterReport {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  created_at: string;
  location_obfuscated: { coordinates: [number, number] } | null;
}

export interface ClusterData {
  id: number;
  cluster_id: number;
  centroid: { coordinates: [number, number] } | null;
  report_count: number;
  case_count: number;
  risk_score: number;
  risk_level: RiskLevel;
  last_updated: string;
  reports?: ClusterReport[];
}

// Severity weights per category
export const SEVERITY_WEIGHTS: Record<ReportCategory, number> = {
  tyre: 3.0,
  water_tank: 2.5,
  pooling_water: 2.0,
  discarded_container: 1.8,
  flower_pot: 1.5,
  blocked_drain: 1.2,
  other: 1.0,
};

// Risk level thresholds (must match SQL function)
export const RISK_THRESHOLDS = {
  critical: 15,
  high: 8,
  medium: 4,
} as const;

/**
 * Time decay factor: e^(-0.1 × days_since_creation)
 * A 7-day-old report retains e^(-0.7) ≈ 50% of its weight.
 * A 30-day-old report retains e^(-3) ≈ 5% of its weight.
 */
export function timDecay(createdAt: string | Date): number {
  const created = new Date(createdAt);
  const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-0.1 * daysSince);
}

/**
 * Calculate risk score for a set of reports and case count.
 * Mirrors the SQL `calculate_risk_score()` function for client-side use.
 */
export function calculateRiskScore(
  reports: Array<{ category: ReportCategory; created_at: string; status: ReportStatus }>,
  nearbyeCaseCount: number = 0
): number {
  const activeReports = reports.filter((r) => r.status !== "cleaned");

  const reportScore = activeReports.reduce((sum, report) => {
    const weight = SEVERITY_WEIGHTS[report.category] ?? 1.0;
    const decay = timDecay(report.created_at);
    return sum + weight * decay;
  }, 0);

  const caseBonus = nearbyeCaseCount * 2.0;

  return Math.round((reportScore + caseBonus) * 100) / 100;
}

/**
 * Classify a numeric risk score into a risk level.
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.critical) return "critical";
  if (score >= RISK_THRESHOLDS.high) return "high";
  if (score >= RISK_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * Risk level color mapping (Tailwind / hex)
 */
export const RISK_COLORS: Record<RiskLevel, { hex: string; tailwind: string; label: string }> = {
  low: { hex: "#3b82f6", tailwind: "text-blue-400", label: "Low Risk" },
  medium: { hex: "#f59e0b", tailwind: "text-amber-400", label: "Medium Risk" },
  high: { hex: "#ef4444", tailwind: "text-red-400", label: "High Risk" },
  critical: { hex: "#dc2626", tailwind: "text-red-600", label: "Critical" },
};

/**
 * Self-clean eligibility check:
 * If a report pin is inside a HIGH-risk cluster (risk >= 8),
 * it must go to `pending_verification` instead of auto-closing.
 */
export function getSelfCleanStatus(
  clusterRiskScore: number | null
): ReportStatus {
  if (clusterRiskScore !== null && clusterRiskScore >= RISK_THRESHOLDS.high) {
    return "pending_verification";
  }
  return "cleaned";
}

/**
 * SLA status for an assigned report.
 */
export function getSlaStatus(assignedAt: string, slaHours: number): {
  hoursElapsed: number;
  isBreached: boolean;
  urgency: "ok" | "warning" | "breached";
} {
  const elapsed = (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60 * 60);
  const isBreached = elapsed > slaHours;
  const urgency = isBreached ? "breached" : elapsed > slaHours * 0.75 ? "warning" : "ok";
  return { hoursElapsed: Math.round(elapsed * 10) / 10, isBreached, urgency };
}
