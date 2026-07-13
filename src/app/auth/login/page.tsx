"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Activity, Lock, Mail } from "lucide-react";
import Footer from "@/components/layout/Footer";

// Inner component that uses useSearchParams — must be wrapped in Suspense
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard/triage";

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setError("Invalid credentials. Please check your email and password.");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
  };

  return (
    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="form-group">
        <label className="form-label" htmlFor="login-email">Email</label>
        <div style={{ position: "relative" }}>
          <Mail
            size={16}
            color="var(--color-text-subtle)"
            style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            id="login-email"
            type="email"
            className="form-input"
            placeholder="you@sci.kln.ac.lk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="login-password">Password</label>
        <div style={{ position: "relative" }}>
          <Lock
            size={16}
            color="var(--color-text-subtle)"
            style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            id="login-password"
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
        id="login-submit-btn"
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        style={{ width: "100%", marginTop: "0.5rem" }}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
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
      {/* Card */}
      <div
        id="login-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          padding: "2rem",
        }}
      >
        {/* Logo */}
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

        <h1 style={{ margin: "0 0 0.375rem", fontSize: "1.375rem" }}>Sign in</h1>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem" }}>
          Access requires a response team account provisioned by the department.
        </p>

        {/* Suspense boundary required for useSearchParams in Next.js 16 */}
        <Suspense fallback={<div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <div style={{ marginTop: "3rem", width: "100%", maxWidth: "400px" }}>
        <Footer />
      </div>
    </div>
  );
}
