"use client";

import { useEffect, useState } from "react";
import { getSlaStatus } from "@/lib/risk-engine";

interface SLATimerProps {
  assignedAt: string;
  slaHours: number;
}

export default function SLATimer({ assignedAt, slaHours }: SLATimerProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { hoursElapsed, isBreached, urgency } = getSlaStatus(assignedAt, slaHours);
  const pct = Math.min((hoursElapsed / slaHours) * 100, 100);
  const remaining = Math.max(slaHours - hoursElapsed, 0);

  return (
    <div
      id={`sla-timer-${assignedAt}`}
      className={`sla-${urgency}`}
      style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
        <span style={{ color: "var(--color-text-muted)" }}>SLA</span>
        <span
          style={{
            color: isBreached
              ? "var(--color-risk-high)"
              : urgency === "warning"
              ? "var(--color-risk-medium)"
              : "#22c55e",
            fontWeight: 600,
          }}
        >
          {isBreached
            ? `BREACHED +${(hoursElapsed - slaHours).toFixed(1)}h`
            : `${remaining.toFixed(1)}h remaining`}
        </span>
      </div>
      <div className="sla-bar">
        <div className="sla-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
