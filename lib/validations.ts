import { z } from "zod";

// ── Sri Lanka bounding box ────────────────────────────────────
const SL_LAT_MIN = 5.9;
const SL_LAT_MAX = 9.9;
const SL_LNG_MIN = 79.6;
const SL_LNG_MAX = 81.9;

const latSchema = z
  .number()
  .min(SL_LAT_MIN, "Latitude outside Sri Lanka bounds")
  .max(SL_LAT_MAX, "Latitude outside Sri Lanka bounds");

const lngSchema = z
  .number()
  .min(SL_LNG_MIN, "Longitude outside Sri Lanka bounds")
  .max(SL_LNG_MAX, "Longitude outside Sri Lanka bounds");

const deviceIdSchema = z
  .string()
  .uuid("Invalid device ID format");

// ── Report Schema (student intake) ───────────────────────────
export const ReportSchema = z.object({
  latitude: latSchema,
  longitude: lngSchema,
  category: z.enum([
    "discarded_container",
    "water_tank",
    "tyre",
    "pooling_water",
    "flower_pot",
    "blocked_drain",
    "other",
  ]),
  description: z
    .string()
    .max(500, "Description too long")
    .optional()
    .nullable(),
  photo_url: z
    .string()
    .url("Invalid photo URL")
    .optional()
    .nullable(),
  cleaned_by_student: z.boolean().default(false),
  device_id: deviceIdSchema,
  institution_slug: z.string().min(1).default("uok"),
});

export type ReportInput = z.infer<typeof ReportSchema>;

// ── Case Schema (self-reported dengue) ───────────────────────
export const CaseSchema = z.object({
  latitude: latSchema,
  longitude: lngSchema,
  contact_info: z
    .string()
    .max(200, "Contact info too long")
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, "Notes too long")
    .optional()
    .nullable(),
  device_id: deviceIdSchema,
  institution_slug: z.string().min(1).default("uok"),
});

export type CaseInput = z.infer<typeof CaseSchema>;

// ── Resolve Schema (response team marks cleaned) ──────────────
export const ResolveSchema = z.object({
  report_id: z.string().uuid("Invalid report ID"),
  after_photo_url: z
    .string()
    .url("Invalid after-photo URL")
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type ResolveInput = z.infer<typeof ResolveSchema>;

// ── Assign Schema (response team assigns to self) ─────────────
export const AssignSchema = z.object({
  cluster_id: z.number().int().positive(),
  institution_slug: z.string().min(1).default("uok"),
});

export type AssignInput = z.infer<typeof AssignSchema>;

// ── Image Upload Validation ───────────────────────────────────
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "File size must be under 5MB." };
  }
  return { ok: true };
}
