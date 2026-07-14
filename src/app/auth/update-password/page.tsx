"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Activity, Lock } from "lucide-react";
import Footer from "@/components/layout/Footer";

function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !window.location.hash.includes("access_token")) {
        setError("Invalid or expired invite link. Please contact your administrator.");
      }
    };
    checkSession();
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message || "Failed to set password. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/dashboard/triage");
  };

  return (
    <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="form-group">
        <label className="form-label" htmlFor="new-password">New Password</label>
        <div style={{ position: "relative" }}>
          <Lock
            size={16}
            color="var(--color-text-subtle)"
            style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            id="new-password"
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem",
            fontSize: "0.8125rem",
            color: "var(--color-risk-high)",
          }}
        >
          {error}
        </div>
      )}

      <button
        id="update-password-submit-btn"
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{ width: "100%", marginTop: "0.5rem" }}
      >
        {loading ? "Setting password…" : "Set Password & Continue"}
      </button>
    </form>
  );
}

export default function UpdatePasswordPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-canvas)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        id="update-password-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "var(--color-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity size={24} color="#0f172a" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.2 }}>UOK Dengue Response</div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Response Team Portal</div>
          </div>
        </div>

        <h1 style={{ margin: "0 0 0.375rem", fontSize: "1.375rem" }}>Welcome!</h1>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem" }}>
          Please set a password for your new response team account to continue.
        </p>

        <Suspense fallback={<div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Loading…</div>}>
          <UpdatePasswordForm />
        </Suspense>
      </div>

      <div style={{ marginTop: "3rem", width: "100%", maxWidth: "400px" }}>
        <Footer />
      </div>
    </div>
  );
}
