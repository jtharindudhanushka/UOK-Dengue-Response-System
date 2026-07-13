-- ============================================================
-- UOK Dengue Response System — Supabase SQL Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for future text search

-- ── ENUMS ────────────────────────────────────────────────────
CREATE TYPE report_status AS ENUM (
  'reported',
  'assigned',
  'pending_verification',
  'cleaned'
);

CREATE TYPE report_category AS ENUM (
  'discarded_container',
  'water_tank',
  'tyre',
  'pooling_water',
  'flower_pot',
  'blocked_drain',
  'other'
);

CREATE TYPE user_role AS ENUM (
  'student',
  'response_team',
  'superadmin'
);

-- ── INSTITUTIONS TABLE (multi-tenant scaffold) ────────────────
-- Defaulting to UOK. Future universities added here, zero migrations.
CREATE TABLE IF NOT EXISTS institutions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT UNIQUE NOT NULL,           -- e.g. 'uok', 'uom'
  name         TEXT NOT NULL,                  -- e.g. 'University of Kelaniya'
  map_center   GEOGRAPHY(POINT, 4326) NOT NULL, -- default map center
  map_zoom     INT NOT NULL DEFAULT 15,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert UOK as the default institution
INSERT INTO institutions (slug, name, map_center, map_zoom) VALUES
  ('uok', 'University of Kelaniya', ST_GeogFromText('POINT(79.9001 7.0018)'), 15)
ON CONFLICT (slug) DO NOTHING;

-- ── PROFILES TABLE ───────────────────────────────────────────
-- Extends Supabase Auth users with roles
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) DEFAULT (SELECT id FROM institutions WHERE slug = 'uok'),
  role           user_role NOT NULL DEFAULT 'response_team',
  display_name   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REPORTS TABLE (Breeding Sites) ───────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id        UUID NOT NULL REFERENCES institutions(id) DEFAULT (SELECT id FROM institutions WHERE slug = 'uok'),
  location              GEOGRAPHY(POINT, 4326) NOT NULL,
  location_obfuscated   GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    -- Snap to ~100m grid for public display
    ST_GeogFromText(
      'POINT(' ||
      ROUND(ST_X(location::geometry)::NUMERIC, 3) || ' ' ||
      ROUND(ST_Y(location::geometry)::NUMERIC, 3) ||
      ')'
    )
  ) STORED,
  category              report_category NOT NULL,
  description           TEXT,
  photo_url             TEXT,                    -- Before photo
  after_photo_url       TEXT,                    -- After / resolution photo
  status                report_status NOT NULL DEFAULT 'reported',
  cleaned_by_student    BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to           UUID REFERENCES profiles(id),
  assigned_at           TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  sla_hours             INT NOT NULL DEFAULT 24,  -- SLA in hours from assignment
  device_id             TEXT NOT NULL,            -- UUID from localStorage (non-PII spam guard)
  cluster_id            INT,                      -- populated by clustering trigger
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS reports_location_idx ON reports USING GIST ((location::geometry));
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status);
CREATE INDEX IF NOT EXISTS reports_cluster_idx ON reports (cluster_id);
CREATE INDEX IF NOT EXISTS reports_institution_idx ON reports (institution_id);

-- ── CASES TABLE (Human Dengue Cases — restricted) ────────────
CREATE TABLE IF NOT EXISTS cases (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) DEFAULT (SELECT id FROM institutions WHERE slug = 'uok'),
  location       GEOGRAPHY(POINT, 4326) NOT NULL,
  student_name   TEXT NOT NULL,
  student_number TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  notes          TEXT,
  consent_given  BOOLEAN NOT NULL DEFAULT false,
  device_id      TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cases_location_idx ON cases USING GIST ((location::geometry));

-- ── CLUSTER CACHE TABLE ───────────────────────────────────────
-- Stores results of ST_ClusterDBSCAN for fast reads
CREATE TABLE IF NOT EXISTS clusters (
  id              SERIAL PRIMARY KEY,
  institution_id  UUID NOT NULL REFERENCES institutions(id),
  cluster_id      INT NOT NULL,                  -- DBSCAN cluster label
  centroid        GEOGRAPHY(POINT, 4326),
  report_count    INT NOT NULL DEFAULT 0,
  case_count      INT NOT NULL DEFAULT 0,
  risk_score      NUMERIC(8, 2) NOT NULL DEFAULT 0,
  risk_level      TEXT NOT NULL DEFAULT 'low',   -- 'low' | 'medium' | 'high' | 'critical'
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (institution_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS clusters_risk_idx ON clusters (risk_score DESC);

-- ── RISK SCORE FUNCTION ───────────────────────────────────────
-- Risk = Σ(severity_weight × time_decay) + (case_proximity_multiplier × nearby_cases)
--
-- Severity weights (category):
--   tyre = 3.0, water_tank = 2.5, pooling_water = 2.0,
--   discarded_container = 1.8, flower_pot = 1.5, blocked_drain = 1.2, other = 1.0
--
-- Time decay: e^(-0.1 × days_since_report) → older reports decay
-- Case proximity: +2.0 per confirmed case within 400m

CREATE OR REPLACE FUNCTION calculate_risk_score(p_institution_id UUID, p_cluster_id INT)
RETURNS NUMERIC AS $$
DECLARE
  v_score       NUMERIC := 0;
  v_case_bonus  NUMERIC := 0;
  v_centroid    GEOMETRY;
BEGIN
  -- Sum severity × time_decay for all active reports in cluster
  SELECT COALESCE(SUM(
    CASE r.category
      WHEN 'tyre'                 THEN 3.0
      WHEN 'water_tank'           THEN 2.5
      WHEN 'pooling_water'        THEN 2.0
      WHEN 'discarded_container'  THEN 1.8
      WHEN 'flower_pot'           THEN 1.5
      WHEN 'blocked_drain'        THEN 1.2
      ELSE                             1.0
    END
    * EXP(-0.1 * EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)
  ), 0)
  INTO v_score
  FROM reports r
  WHERE r.institution_id = p_institution_id
    AND r.cluster_id = p_cluster_id
    AND r.status NOT IN ('cleaned');

  -- Get cluster centroid
  SELECT ST_Centroid(ST_Collect(location::geometry))
  INTO v_centroid
  FROM reports
  WHERE institution_id = p_institution_id
    AND cluster_id = p_cluster_id
    AND status NOT IN ('cleaned');

  -- Case proximity bonus: +2 per confirmed case within 400m
  IF v_centroid IS NOT NULL THEN
    SELECT COALESCE(COUNT(*) * 2.0, 0)
    INTO v_case_bonus
    FROM cases c
    WHERE c.institution_id = p_institution_id
      AND ST_DWithin(c.location::geometry, v_centroid, 400);
  END IF;

  RETURN ROUND(v_score + v_case_bonus, 2);
END;
$$ LANGUAGE plpgsql;

-- ── CLUSTERING & REFRESH FUNCTION ────────────────────────────
CREATE OR REPLACE FUNCTION refresh_clusters(p_institution_id UUID DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_institution_id UUID;
BEGIN
  -- If no institution specified, refresh all
  FOR v_institution_id IN
    SELECT id FROM institutions WHERE (p_institution_id IS NULL OR id = p_institution_id)
  LOOP
    -- Assign cluster IDs using DBSCAN (400m radius, min 2 points)
    -- eps=400m ≈ 0.0036 degrees at equator (PostGIS uses meters for geography)
    UPDATE reports r
    SET cluster_id = sub.cid
    FROM (
      SELECT
        id,
        ST_ClusterDBSCAN(location::geometry, eps := 400, minpoints := 2)
          OVER (PARTITION BY institution_id) AS cid
      FROM reports
      WHERE institution_id = v_institution_id
        AND status NOT IN ('cleaned')
    ) sub
    WHERE r.id = sub.id
      AND r.institution_id = v_institution_id;

    -- Upsert cluster cache rows
    INSERT INTO clusters (institution_id, cluster_id, centroid, report_count, case_count, risk_score, risk_level, last_updated)
    SELECT
      v_institution_id,
      r.cluster_id,
      ST_GeogFromText('POINT(' ||
        ST_X(ST_Centroid(ST_Collect(r.location::geometry))) || ' ' ||
        ST_Y(ST_Centroid(ST_Collect(r.location::geometry))) ||
      ')'),
      COUNT(*),
      (
        SELECT COUNT(*) FROM cases c
        WHERE c.institution_id = v_institution_id
          AND ST_DWithin(
            c.location::geometry,
            ST_Centroid(ST_Collect(r.location::geometry)),
            400
          )
      ),
      calculate_risk_score(v_institution_id, r.cluster_id),
      CASE
        WHEN calculate_risk_score(v_institution_id, r.cluster_id) >= 15 THEN 'critical'
        WHEN calculate_risk_score(v_institution_id, r.cluster_id) >= 8  THEN 'high'
        WHEN calculate_risk_score(v_institution_id, r.cluster_id) >= 4  THEN 'medium'
        ELSE 'low'
      END,
      NOW()
    FROM reports r
    WHERE r.institution_id = v_institution_id
      AND r.cluster_id IS NOT NULL
      AND r.status NOT IN ('cleaned')
    GROUP BY r.cluster_id
    ON CONFLICT (institution_id, cluster_id) DO UPDATE SET
      centroid     = EXCLUDED.centroid,
      report_count = EXCLUDED.report_count,
      case_count   = EXCLUDED.case_count,
      risk_score   = EXCLUDED.risk_score,
      risk_level   = EXCLUDED.risk_level,
      last_updated = NOW();

    -- Remove clusters that no longer exist
    DELETE FROM clusters
    WHERE institution_id = v_institution_id
      AND cluster_id NOT IN (
        SELECT DISTINCT cluster_id FROM reports
        WHERE institution_id = v_institution_id AND cluster_id IS NOT NULL
      );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ── TRIGGER: Refresh clusters on report insert/update ─────────
CREATE OR REPLACE FUNCTION trigger_refresh_clusters()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_clusters(NEW.institution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_report_change ON reports;
CREATE TRIGGER on_report_change
  AFTER INSERT OR UPDATE OF status, location ON reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_clusters();

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SLA BREACH VIEW ───────────────────────────────────────────
CREATE OR REPLACE VIEW sla_breaches AS
SELECT
  r.id,
  r.institution_id,
  r.cluster_id,
  r.status,
  r.assigned_at,
  r.sla_hours,
  r.assigned_to,
  p.display_name AS assignee_name,
  EXTRACT(EPOCH FROM (NOW() - r.assigned_at)) / 3600.0 AS hours_elapsed,
  (EXTRACT(EPOCH FROM (NOW() - r.assigned_at)) / 3600.0) > r.sla_hours AS is_breached
FROM reports r
LEFT JOIN profiles p ON p.id = r.assigned_to
WHERE r.status = 'assigned'
  AND r.assigned_at IS NOT NULL;

-- ── ENABLE ROW LEVEL SECURITY ─────────────────────────────────
ALTER TABLE institutions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters        ENABLE ROW LEVEL SECURITY;

-- ── RLS: institutions ─────────────────────────────────────────
CREATE POLICY "institutions_public_read" ON institutions
  FOR SELECT TO anon, authenticated USING (true);

-- ── RLS: profiles ─────────────────────────────────────────────
CREATE POLICY "profiles_own_read" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "profiles_own_insert" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ── RLS: reports ─────────────────────────────────────────────
-- anon: can INSERT (via API route with service role — this policy is secondary)
-- anon: can SELECT only obfuscated coordinates + non-sensitive fields
-- authenticated: full access within their institution
CREATE POLICY "reports_anon_insert" ON reports
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "reports_anon_select_sanitized" ON reports
  FOR SELECT TO anon
  USING (status NOT IN ('cleaned') OR cleaned_by_student = false)
  -- Note: client query must use location_obfuscated, not location
  ;

CREATE POLICY "reports_auth_all" ON reports
  FOR ALL TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── RLS: cases ───────────────────────────────────────────────
-- anon: can INSERT only
-- authenticated: full SELECT within their institution
CREATE POLICY "cases_anon_insert" ON cases
  FOR INSERT TO anon
  WITH CHECK (true);

-- EXPLICITLY no SELECT policy for anon → returns 0 rows
CREATE POLICY "cases_auth_select" ON cases
  FOR SELECT TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "cases_auth_all" ON cases
  FOR ALL TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ── RLS: clusters ─────────────────────────────────────────────
CREATE POLICY "clusters_public_read" ON clusters
  FOR SELECT TO anon, authenticated USING (true);

-- ── STORAGE BUCKET (run separately if needed) ─────────────────
-- Create via Supabase Dashboard → Storage → New Bucket
-- OR run with service role:
--
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'report-photos',
--   'report-photos',
--   true,
--   5242880,  -- 5MB
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
-- )
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage RLS (run in SQL editor):
-- CREATE POLICY "photos_public_read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'report-photos');
-- CREATE POLICY "photos_anon_insert" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'report-photos');
-- CREATE POLICY "photos_auth_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'report-photos');

-- ── SEED: Initial data ────────────────────────────────────────
-- (Optional) Insert a test superadmin profile after creating the auth user:
-- INSERT INTO profiles (id, institution_id, role, display_name)
-- VALUES ('<your-auth-user-uuid>', (SELECT id FROM institutions WHERE slug='uok'), 'superadmin', 'Admin');
