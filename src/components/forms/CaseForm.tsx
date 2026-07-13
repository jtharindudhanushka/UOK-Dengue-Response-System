"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, MapPin, CheckSquare, Square, CheckCircle2 } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

interface CaseFormProps {
  deviceId: string;
  userLocation?: [number, number] | null;
  selectedPin?: [number, number] | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CaseForm({ deviceId, userLocation, selectedPin, onSuccess, onClose }: CaseFormProps) {
  const [location, setLocation] = useState<[number, number] | null>(selectedPin ?? userLocation ?? null);
  const [studentName, setStudentName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Use test site key for development if real one is not available
  const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  // Auto-populate from map tap/pin mode
  useEffect(() => {
    if (selectedPin) {
      setLocation(selectedPin);
    }
  }, [selectedPin]);

  const validate = () => {
    if (!studentName || studentName.length < 2) return "Student name must be at least 2 characters.";
    if (!/^[A-Z]{2,4}\/\d{4}\/\d{3}$/i.test(studentNumber)) return "Invalid student number format (e.g., IM/2023/142).";
    if (!/^(?:0|(?:\+94))[7][0-9]{8}$/.test(contactNumber)) return "Invalid Sri Lankan contact number.";
    if (!consentGiven) return "You must consent to sharing this information.";
    if (!turnstileToken) return "Please complete the security check.";
    if (!location) return "Please allow location access to submit.";
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-ID": deviceId,
        },
        body: JSON.stringify({
          latitude: location![0],
          longitude: location![1],
          student_name: studentName,
          student_number: studentNumber.toUpperCase(),
          contact_number: contactNumber,
          consent_given: consentGiven,
          turnstile_token: turnstileToken,
          notes: notes || null,
          device_id: deviceId,
          institution_slug: "uok",
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "Submission failed.");
        return;
      }

      setSuccess(true);
      setTimeout(onSuccess, 2500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏥</div>
        <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Reported securely.</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          Thank you for helping us map the outbreak. <strong>Please visit the Medical Centre immediately for treatment.</strong>
        </p>
      </div>
    );
  }

  return (
    <div id="case-form" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Warning */}
      <div
        style={{
          background: "var(--color-surface-elevated)",
          border: "1px solid var(--color-hairline)",
          borderRadius: "var(--rounded-md)",
          padding: "12px 16px",
        }}
      >
        <div style={{ fontSize: "13px", color: "var(--color-muted)", lineHeight: 1.5 }}>
          This data is used <strong>strictly for spatial risk mapping</strong> by the Response Team. This is not a medical dispatch system. <strong style={{ color: "var(--color-accent-rose)" }}>Please visit the University Medical Centre immediately.</strong>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Name */}
        <div className="form-group">
          <label className="form-label">Student Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. John Doe"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
        </div>

        {/* Student Number */}
        <div className="form-group">
          <label className="form-label">Student Number</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. IM/2023/114"
            value={studentNumber}
            onChange={(e) => setStudentNumber(e.target.value.toUpperCase())}
            style={{ textTransform: "uppercase" }}
          />
        </div>

        {/* Contact */}
        <div className="form-group">
          <label className="form-label">Contact Number</label>
          <input
            type="tel"
            className="form-input"
            placeholder="e.g. 0712345678"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Symptoms & Notes (optional)</label>
          <textarea
            className="form-textarea"
            placeholder="Symptoms, onset date, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
          />
        </div>

        {/* Location (always pinned via map now) */}
        {location && (
          <div
            style={{
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--rounded-lg)",
              padding: "16px",
              fontSize: "13px",
              color: "var(--color-accent-emerald)",
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <CheckCircle2 size={16} /> Location securely pinned
          </div>
        )}

        {/* Consent Checkbox */}
        <label
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
            cursor: "pointer",
            marginTop: "8px",
            padding: "12px",
            borderRadius: "var(--rounded-md)",
            background: "var(--color-surface-elevated)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
          />
          <div style={{ fontSize: "13px", color: "var(--color-on-dark)", lineHeight: 1.5 }}>
            I understand this report is for mapping purposes only and does not replace medical care. I consent to the Response Team using my details for verification.
          </div>
        </label>

        {/* Cloudflare Turnstile */}
        <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "center" }}>
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(token)}
            options={{ theme: "dark" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ fontSize: "0.8125rem", color: "var(--color-risk-high)", textAlign: "center" }}>{error}</div>
      )}

      <button
        id="case-form-submit-btn"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting || !location || !consentGiven || !turnstileToken}
        style={{ width: "100%", marginTop: "8px" }}
      >
        {submitting ? "Submitting Securely…" : "Report Medical Case"}
      </button>
    </div>
  );
}
