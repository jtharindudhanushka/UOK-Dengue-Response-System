"use client";

import { useState, useCallback } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validateImageFile } from "@/lib/validations";

interface ResolveFormProps {
  reportId: string;
  onSuccess: () => void;
}

export default function ResolveForm({ reportId, onSuccess }: ResolveFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.ok) { setError(validation.error); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      let afterPhotoUrl: string | null = null;

      if (photoFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const filename = `after/${user?.id ?? "anon"}-${reportId}-${Date.now()}.${ext}`;

        const { data, error: uploadErr } = await supabase.storage
          .from("report-photos")
          .upload(filename, photoFile, { contentType: photoFile.type });

        if (uploadErr) {
          setError("Failed to upload after-photo.");
          setSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
        afterPhotoUrl = urlData.publicUrl;
      }

      const res = await fetch(`/api/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ after_photo_url: afterPhotoUrl, notes }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "Failed to mark as cleaned.");
        return;
      }

      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [photoFile, notes, reportId, supabase, onSuccess]);

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "1.5rem" }}>
        <CheckCircle2 size={40} color="#22c55e" style={{ margin: "0 auto 0.75rem" }} />
        <h3 style={{ fontWeight: 700 }}>Site marked as cleaned</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          The risk engine will recalculate the cluster score.
        </p>
      </div>
    );
  }

  return (
    <div id="resolve-form" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <p style={{ margin: 0 }}>
        Upload an &quot;after&quot; photo to confirm the site has been cleaned, then mark it as resolved.
      </p>

      {/* After photo upload */}
      {photoPreview ? (
        <div style={{ position: "relative" }}>
          <img
            src={photoPreview}
            alt="After cleanup"
            style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "var(--radius-sm)" }}
          />
        </div>
      ) : (
        <label
          id="resolve-photo-upload"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            padding: "2rem 1rem",
            background: "var(--color-canvas)",
            border: "2px dashed var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          <Upload size={24} color="var(--color-text-muted)" />
          <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>Upload after-photo (optional)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
          />
        </label>
      )}

      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <textarea
          className="form-textarea"
          placeholder="Any notes about the cleanup…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {error && <div style={{ color: "var(--color-risk-high)", fontSize: "0.8125rem" }}>{error}</div>}

      <button
        id="resolve-submit-btn"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: "100%" }}
      >
        {submitting ? "Saving…" : "✓ Mark as cleaned"}
      </button>
    </div>
  );
}
