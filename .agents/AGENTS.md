# UOK Dengue Response System — Business Logic & Architecture

**Product Name:** UOK Dengue Response System  
**Version:** 1.0.0  
**Maintained by:** Department of Industrial Management, Faculty of Science, University of Kelaniya  
**Deployment:** Vercel (Free) + Supabase (Free tier)

---

## 1. System Architecture

```
Browser (Public / Response Team) 
    │
    ├─► Next.js App Router (Vercel)
    │       ├─ /app/(public)         ← anonymous student pages
    │       ├─ /app/dashboard/*      ← authenticated response team
    │       ├─ /app/api/*            ← hardened API routes
    │       └─ Leaflet Map           ← Google Roadmap / Satellite / CartoDB Dark (LayersControl)
    │
    └─► Supabase (PostgreSQL + PostGIS + Auth + Storage)
            ├─ Database (reports, cases, clusters, profiles, institutions)
            ├─ Auth (email/password — response team + superadmin)
            ├─ Storage (report-photos bucket, 5MB limit)
            └─ Row Level Security (enforced at DB layer)
```

---

## 2. Multi-Tenant Scalability

The system is scoped to UOK (`institution_slug = 'uok'`) but every table contains an `institution_id UUID` foreign key. To onboard a new university:

1. Insert a new row into `institutions` with the new `slug`, `name`, and `map_center`.
2. Create a superadmin `profiles` row pointing to the new institution.
3. All RLS policies automatically filter by `institution_id` — zero code changes needed.

---

## 3. State Machine — Report Status Transitions

```
[Student submits report]
         │
         ▼
    ┌─ reported ─┐
    │             │
    │  [Response team assigns cluster]
    │             │
    │             ▼
    │         assigned ──── SLA timer starts (24h default)
    │             │
    │  [Team uploads after-photo, marks cleaned]
    │             │
    │             ▼
    │    ┌── cleaned ◄──────────────────── (self-clean, low risk)
    │    │
    │    └──pending_verification ◄──────── (self-clean, high risk: ≥3 nearby reports OR score ≥ 8)
    │             │
    │  [Response team visually confirms on patrol]
    │             │
    │             ▼
    │          cleaned
    │
    └── [Self-clean: student toggles "I cleaned this"]
             │
             ├─ cluster risk_score < 8 → status = cleaned (auto-closed)
             └─ cluster risk_score ≥ 8 → status = pending_verification
```

**All transitions are enforced server-side** in `/api/reports/[id]/route.ts`.  
The UI reflects state but cannot bypass the server checks.

---

## 4. Risk Engine Formula

```
Risk = Σ(severity_weight[category] × time_decay(created_at))
       + (2.0 × nearby_case_count)
```

### Severity Weights

| Category | Weight |
|---|---|
| tyre | 3.0 |
| water_tank | 2.5 |
| pooling_water | 2.0 |
| discarded_container | 1.8 |
| flower_pot | 1.5 |
| blocked_drain | 1.2 |
| other | 1.0 |

### Time Decay

```
decay(t) = e^(-0.1 × days_since_report)
```

A 7-day-old report retains ~50% weight. A 30-day-old report retains ~5%.

### Case Proximity Bonus

+2.0 per confirmed dengue case within 400m of the cluster centroid (admin-only data).

### Risk Level Thresholds

| Score | Level |
|---|---|
| ≥ 15 | critical |
| ≥ 8 | high |
| ≥ 4 | medium |
| < 4 | low |

The SQL function `calculate_risk_score()` mirrors this formula exactly. The TypeScript `lib/risk-engine.ts` mirrors it for client-side preview only; the authoritative score always comes from PostgreSQL.

---

## 5. Clustering Algorithm

- Algorithm: `ST_ClusterDBSCAN` (PostGIS)
- `eps` = 400 meters (Aedes mosquito flight range)
- `minpoints` = 2 (at least 2 reports to form a cluster)
- Singleton reports (`cluster_id = NULL`) are shown as individual pins

Clustering runs via a PostgreSQL trigger (`on_report_change`) on every `INSERT` or `UPDATE` of `status` or `location` on the `reports` table.

---

## 6. Rate Limiting Strategy (Campus WiFi Safe)

### Layer 1 — Device ID (primary spam guard)
- A UUID `device_id` is generated on first visit and stored in `localStorage`.
- Sent as `X-Device-ID` header with every report submission.
- Server maintains an in-memory sliding window: **5 reports / 10 minutes per device**.
- Safe on campus WiFi — does not affect other students sharing the same IP.

### Layer 2 — IP rate limit (DoS guard)
- **100 requests / minute per IP** — a very high threshold.
- This is exclusively for blocking scripted attacks, not legitimate users.
- Even with 200 students on the same IP, normal usage never approaches this limit.

---

## 7. Security Architecture

### Row Level Security (RLS)

| Table | anon | authenticated |
|---|---|---|
| `institutions` | SELECT ✅ | SELECT ✅ |
| `reports` | INSERT ✅, SELECT (obfuscated) ✅ | ALL ✅ (own institution) |
| `cases` | INSERT ✅, SELECT ❌ | ALL ✅ (own institution) |
| `clusters` | SELECT ✅ | SELECT ✅ |
| `profiles` | — | Own row only |

### Coordinate Obfuscation

Public-facing `location_obfuscated` column is a generated column that snaps coordinates to a ~100m grid using `ROUND(coord, 3)`. The exact `location` column is never returned to `anon` clients.

### Key Separation

| Key | Exposure |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client bundle (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client bundle (safe — RLS enforces all restrictions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only (`/api/*` routes) — NEVER in client code |

### API Route Pipeline (every submission route)

1. Zod schema validation
2. Device-ID rate limit check (Layer 1)
3. IP rate limit check (Layer 2)
4. Service-role Supabase insert
5. Sanitized response (no raw coordinates returned)

---

## 8. Workflow Descriptions

### Workflow 1 — Intake (Anonymous Student)
1. Student opens public map at `/`
2. Taps "Report a site" → bottom sheet opens
3. Grants GPS or taps map to place pin
4. Selects category, optionally uploads photo
5. Optionally toggles "I cleaned this"
6. Taps submit → `POST /api/reports`
7. Server validates, rate-limits, inserts → status = `reported`
8. Submission recorded in `localStorage` to prevent UI spam

### Workflow 2 — Automated Clustering (Brain)
1. `on_report_change` trigger fires on report insert
2. `refresh_clusters()` runs `ST_ClusterDBSCAN(eps=400, minpoints=2)`
3. Reports assigned to cluster IDs, singletons get `cluster_id = NULL`
4. `clusters` table updated with centroid, report count, risk score, risk level
5. Map auto-refreshes every 2 minutes, showing updated risk zones

### Workflow 3 — Triage & Assignment (Response Team)
1. Response team logs in at `/auth/login`
2. Navigates to `/dashboard/triage`
3. Clusters listed sorted by risk score (descending)
4. Clicks "Assign to me" on highest-priority cluster
5. `PUT /api/reports/[cluster_id]` updates all `reported` → `assigned`
6. `assigned_at` timestamp set — SLA timer starts (24h)

### Workflow 4 — Resolution
1. Team physically visits site, performs cleanup
2. Navigates to `/dashboard/resolve?cluster=[id]`
3. Views before photo, uploads after photo
4. Clicks "Mark as cleaned"
5. `PATCH /api/reports/[id]` → status = `cleaned`, `resolved_at` set
6. `on_report_change` trigger fires → risk score recalculated → cluster threat drops

### Workflow 5 — Volunteer Cleanup & Self-Cleaning (Edge Cases)
1. **At submission:** Student submits report with `cleaned_by_student = true`
2. **After submission:** Public map users click "I can clean this site" on existing unassigned pins (`volunteer_clean = true`)
3. API calls `check_high_risk_cluster()` logic to check nearby cluster risk
4. If cluster risk < 8 (no high-risk cluster nearby) → status = `cleaned` (auto-closed)
5. If cluster risk ≥ 8 → status = `pending_verification`
6. Response team sees `pending_verification` reports in triage view
7. Team confirms on patrol → manually marks as `cleaned`

### Workflow 6 — Oversight (Superadmin)
1. Superadmin logs in, navigates to `/dashboard/admin`
2. Server verifies `profile.role === 'superadmin'`
3. Views: total reports, active/cleaned, case count, SLA breaches, avg resolution time
4. Views student-reported cases feed (strictly hidden from public routes)
5. Exports all data as CSV for medical centre coordination

---

## 9. SLA Policy

- Default SLA: **24 hours** from assignment to `cleaned`
- Breach is flagged at `hours_elapsed > sla_hours`
- Visible in: `sla_breaches` view, admin dashboard breach table, per-report SLATimer component
- Urgency levels: `ok` (< 75% elapsed), `warning` (≥ 75%), `breached` (> 100%)

---

## 10. Future Scalability Notes

| Feature | How to scale |
|---|---|
| Multi-university | Add row to `institutions`, provision profiles — no code changes |
| Push notifications | Add Supabase Realtime subscriptions on `clusters` table |
| ML risk prediction | Replace `calculate_risk_score()` with Edge Function calling an ML model |
| Offline support | Add service worker + IndexedDB queue for offline report submission |
| SMS alerts | Add Twilio/Dialog webhook on cluster risk level change |
