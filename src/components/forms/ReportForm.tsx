"use client";

import { useState, useCallback, useEffect } from "react";
import {
  MapPin, Upload, CheckCircle2, AlertCircle, X,
  Trash2, Droplets, FlaskConical, Flower2, AlertTriangle,
  Boxes, HelpCircle,
} from "lucide-react";
import { validateImageFile } from "@/lib/validations";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { value: "tyre", label: "Tyre / Tube", icon: <Trash2 size={18} /> },
  { value: "water_tank", label: "Water tank", icon: <Boxes size={18} /> },
  { value: "pooling_water", label: "Pooling water", icon: <Droplets size={18} /> },
  { value: "discarded_container", label: "Discarded container", icon: <FlaskConical size={18} /> },
  { value: "flower_pot", label: "Flower pot", icon: <Flower2 size={18} /> },
  { value: "blocked_drain", label: "Blocked drain", icon: <AlertTriangle size={18} /> },
  { value: "other", label: "Other", icon: <HelpCircle size={18} /> },
];

interface ReportFormProps {
  deviceId: string;
  userLocation?: [number, number] | null;
  selectedPin?: [number, number] | null;
  onSuccess: () => void;
  onClose: () => void;
}

type Step = "location" | "category" | "photo" | "submit";

export default function ReportForm({ deviceId, userLocation, selectedPin, onSuccess, onClose }: ReportFormProps) {
  const [step, setStep] = useState<Step>("location");
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(userLocation ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [selfCleaned, setSelfCleaned] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  // Auto-populate location from parent GPS context or map tap
  useEffect(() => {
    if (selectedPin) {
      setSelectedLocation(selectedPin);
    } else if (userLocation && !selectedLocation) {
      setSelectedLocation(userLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, selectedPin]);


  // ── Get current GPS location ──────────────────────────────
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelectedLocation([pos.coords.latitude, pos.coords.longitude]);
        setStep("category");
        setError(null);
      },
      () => {
        setError("Could not get your location. Please tap a spot on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // ── Photo handling ────────────────────────────────────────
  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  }, []);

  const uploadPhoto = useCallback(async (): Promise<string | null> => {
    if (!photoFile) return null;
    setUploading(true);

    try {
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const filename = `${deviceId}-${Date.now()}.${ext}`;

      const { data, error } = await supabase.storage
        .from("report-photos")
        .upload(`before/${filename}`, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("report-photos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (err) {
      console.error("Photo upload error:", err);
      setError("Failed to upload photo. Please try again.");
      return null;
    } finally {
      setUploading(false);
    }
  }, [photoFile, deviceId, supabase]);

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedLocation || !selectedCategory) return;

    setSubmitting(true);
    setError(null);

    try {
      // Upload photo if provided
      let uploadedUrl: string | null = null;
      if (photoFile) {
        uploadedUrl = await uploadPhoto();
        if (!uploadedUrl && photoFile) {
          setSubmitting(false);
          return; // Error already set by uploadPhoto
        }
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-ID": deviceId,
        },
        body: JSON.stringify({
          latitude: selectedLocation[0],
          longitude: selectedLocation[1],
          category: selectedCategory,
          description: description || null,
          photo_url: uploadedUrl,
          cleaned_by_student: selfCleaned,
          device_id: deviceId,
          institution_slug: "uok",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Submission failed. Please try again.");
        return;
      }

      // Store in localStorage to prevent UI spam
      const existing = JSON.parse(localStorage.getItem("uok_drs_reports") ?? "[]");
      existing.push({ id: result.report.id, ts: Date.now() });
      localStorage.setItem("uok_drs_reports", JSON.stringify(existing.slice(-10)));

      setSuccess(true);
      setTimeout(onSuccess, 2000);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedLocation, selectedCategory, description, selfCleaned, photoFile, deviceId, uploadPhoto, onSuccess]);

  // ── Success screen ───────────────────────────────────
  if (success) {
    return (
      <div id="report-form-success" style={{ textAlign: "center", padding: "2rem 1rem" }}>
        <div
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}
        >
          <CheckCircle2 size={28} color="#22c55e" />
        </div>
        <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Report submitted</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
          Thank you. The response team has been notified and will action this report.
        </p>
      </div>
    );
  }

  const progressMap: Record<Step, number> = {
    location: 25,
    category: 50,
    photo: 75,
    submit: 100,
  };
  const progress = progressMap[step];

  return (
    <div id="report-form" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ height: "4px", background: "var(--color-hairline)", borderRadius: "2px", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--color-primary)",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "0.75rem",
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={16} color="var(--color-risk-high)" style={{ flexShrink: 0, marginTop: "2px" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--color-risk-high)" }}>{error}</span>
        </div>
      )}

      {step === "location" && (
        <div style={{ marginTop: "1rem" }}>
          {!selectedLocation ? (
            <div style={{
              background: "var(--color-surface-card)",
              border: "1px dashed var(--color-hairline-strong)",
              borderRadius: "var(--rounded-lg)",
              padding: "1rem",
              textAlign: "center",
              marginTop: "0.5rem"
            }}>
              <MapPin size={24} color="var(--color-primary)" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-primary)", marginBottom: "4px" }}>Location Required</div>
              <div style={{ fontSize: "13px", color: "var(--color-muted)" }}>
                Tap on the map above to select the exact location.
              </div>
              <button
                className="btn btn-secondary"
                onClick={getCurrentLocation}
                style={{ marginTop: "0.75rem", width: "100%", fontSize: "0.8125rem" }}
              >
                Or use my current GPS location
              </button>
            </div>
          ) : (
            <div
              style={{
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-hairline)",
                borderRadius: "var(--rounded-lg)",
                padding: "16px",
                fontSize: "13px",
                color: "var(--color-accent-emerald)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              Location pinned. Tap "Continue" to proceed.
            </div>
          )}
          {selectedLocation && (
            <button
              id="report-location-continue-btn"
              className="btn btn-primary"
              onClick={() => setStep("category")}
            >
              Continue →
            </button>
          )}
        </div>
      )}

      {/* ── Step: Category ── */}
      {step === "category" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                id={`report-cat-${cat.value}`}
                onClick={() => setSelectedCategory(cat.value)}
                style={{
                  background:
                    selectedCategory === cat.value
                      ? "var(--color-surface-elevated)"
                      : "var(--color-surface-card)",
                  border: `1px solid ${selectedCategory === cat.value ? "var(--color-primary)" : "var(--color-hairline)"}`,
                  borderRadius: "var(--rounded-md)",
                  padding: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <span style={{ fontSize: "20px", color: selectedCategory === cat.value ? "var(--color-primary)" : "var(--color-on-dark)" }}>{cat.icon}</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: selectedCategory === cat.value ? "var(--color-on-dark)" : "var(--color-muted)", lineHeight: 1.3 }}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>

          {/* Self-cleaned toggle */}
          <label
            id="report-self-cleaned-toggle"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "12px",
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-hairline)",
              borderRadius: "var(--rounded-md)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={selfCleaned}
              onChange={(e) => setSelfCleaned(e.target.checked)}
            />
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-on-dark)", marginBottom: "2px" }}>
                I already cleaned this site
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-muted)" }}>
                The report may still be verified if in a high-risk area
              </div>
            </div>
          </label>

          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Any additional details about the site…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          <button
            id="report-category-continue-btn"
            className="btn btn-primary"
            disabled={!selectedCategory}
            onClick={() => setStep("photo")}
          >
            Continue →
          </button>
        </div>
      )}

      {/* ── Step: Photo ── */}
      {step === "photo" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p style={{ margin: 0 }}>
            A photo helps the response team prioritize. Max 5MB, JPEG/PNG/WebP.
          </p>

          {photoPreview ? (
            <div style={{ position: "relative" }}>
              <img
                src={photoPreview}
                alt="Preview"
                style={{
                  width: "100%",
                  maxHeight: "200px",
                  objectFit: "cover",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                style={{
                  position: "absolute",
                  top: "0.5rem",
                  right: "0.5rem",
                  background: "rgba(0,0,0,0.7)",
                  border: "none",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} color="#f8fafc" />
              </button>
            </div>
          ) : (
            <label
              id="report-photo-upload"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                padding: "2rem 1rem",
                background: "var(--color-surface-card)",
                border: "2px dashed var(--color-hairline-strong)",
                borderRadius: "var(--rounded-lg)",
                cursor: "pointer",
              }}
            >
              <Upload size={24} color="var(--color-muted)" />
              <span style={{ fontSize: "14px", color: "var(--color-muted)" }}>
                Tap to upload photo
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />
            </label>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setStep("submit")}
            >
              Skip
            </button>
            <button
              id="report-photo-continue-btn"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={uploading}
              onClick={() => setStep("submit")}
            >
              {uploading ? "Uploading…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Submit ── */}
      {step === "submit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card-elevated" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>Category</span>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>
                {CATEGORIES.find((c) => c.value === selectedCategory)?.label ?? selectedCategory}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>Photo</span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: photoFile ? "var(--color-accent-emerald)" : "var(--color-on-dark)" }}>{photoFile ? "✓ Attached" : "Not provided"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: 600 }}>Self-cleaned</span>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{selfCleaned ? "Yes" : "No"}</span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "0.8125rem" }}>
            Your exact location is never shown publicly. Pins are offset to protect your privacy.
          </p>

          <button
            id="report-submit-btn"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width: "100%" }}
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      )}
    </div>
  );
}
