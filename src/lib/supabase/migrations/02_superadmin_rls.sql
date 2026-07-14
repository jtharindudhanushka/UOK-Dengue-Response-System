-- ============================================================
-- UOK Dengue Response System
-- INCREMENTAL MIGRATION: 02_superadmin_rls
-- Run this in Supabase Dashboard -> SQL Editor
-- ============================================================

-- Allow Superadmins to read all profiles in their institution
CREATE POLICY "profiles_superadmin_read_all" ON profiles
  FOR SELECT TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- Allow Superadmins to update roles of profiles in their institution
CREATE POLICY "profiles_superadmin_update_all" ON profiles
  FOR UPDATE TO authenticated
  USING (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT institution_id FROM profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
