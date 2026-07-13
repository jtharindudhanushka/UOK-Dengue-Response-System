# UOK Dengue Response System — Free-Tier Setup Guide

**Everything here is 100% free.** No credit card required for development or staging deployment.

---

## Prerequisites

- Node.js 18+ installed
- npm 9+
- A Supabase account (free at [supabase.com](https://supabase.com))
- A Vercel account (free at [vercel.com](https://vercel.com)) — for deployment
- Git installed

---

## Step 1 — Clone and install

```bash
cd "UOK Dengue Response System/uok-drs"
npm install
```

---

## Step 2 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it: `uok-dengue-response`
3. Set a strong database password — save it somewhere safe
4. Choose region: **Singapore** (closest to Sri Lanka on free tier)
5. Click **Create new project** — wait ~2 minutes

---

## Step 3 — Enable PostGIS

1. In your Supabase dashboard, go to **Database → Extensions**
2. Search for `postgis`
3. Click the toggle to **Enable**

---

## Step 4 — Run the SQL schema

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New query**
3. Open `lib/supabase/schema.sql` from this project
4. Copy the **entire file** and paste into the SQL editor
5. Click **Run** (or press Ctrl+Enter)

You should see "Success. No rows returned."

---

## Step 5 — Create the Storage bucket

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name it exactly: `report-photos`
4. Check **Public bucket** ✅
5. Click **Create bucket**
6. Go to **Policies** on the `report-photos` bucket
7. Add the following policies:

```sql
-- Allow anonymous uploads (before photo)
CREATE POLICY "photos_anon_insert"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'report-photos');

-- Allow public reads
CREATE POLICY "photos_public_read"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'report-photos');

-- Allow authenticated to manage
CREATE POLICY "photos_auth_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'report-photos');
```

Paste these into the SQL Editor and run them.

---

## Step 6 — Get your API keys

1. Go to **Project Settings → API**
2. Copy:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public** key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`) — keep this SECRET

---

## Step 7 — Configure environment variables

```bash
# In the uok-drs directory:
copy .env.local.example .env.local
```

Open `.env.local` and fill in your keys from Step 6:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_INSTITUTION_SLUG=uok
```

---

## Step 8 — Create the first superadmin user

1. Go to **Authentication → Users** in Supabase dashboard
2. Click **Invite user**
3. Enter your university email (e.g., `admin@sci.kln.ac.lk`)
4. Click **Invite** — they'll get a magic link email
5. Once they click the link and set a password, copy their **User UID** from the Users table
6. Go to **SQL Editor** and run:

```sql
INSERT INTO profiles (id, institution_id, role, display_name)
VALUES (
  'PASTE-USER-UUID-HERE',
  (SELECT id FROM institutions WHERE slug = 'uok'),
  'superadmin',
  'Dr. Admin Name'
);
```

---

## Step 9 — Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the dark map centered on the University of Kelaniya.

Test the flows:
- ✅ Tap "Report a site" → submit a test report
- ✅ Check Supabase → Table Editor → `reports` — your row should appear
- ✅ Log in at `/auth/login` with your superadmin credentials
- ✅ Visit `/dashboard/triage` — clusters should appear after 2+ reports within 400m

---

## Step 10 — Deploy to Vercel (free)

### Option A: GitHub (recommended)

1. Push the `uok-drs` folder to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. Set **Root Directory** to `uok-drs` (or leave blank if repo root)
5. Add your environment variables (same as `.env.local`) in the Vercel dashboard
6. Click **Deploy**

### Option B: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
# Follow prompts — set env vars when asked
```

### After deploy

1. Copy your Vercel production URL (e.g., `https://uok-drs.vercel.app`)
2. Go to Supabase → **Authentication → URL Configuration**
3. Add your Vercel URL to **Site URL**
4. Add `https://uok-drs.vercel.app/auth/callback` to **Redirect URLs**

---

## Step 11 — Create response team accounts

For each response team member:

1. Go to Supabase → Authentication → Users → Invite user
2. After they accept the invite, add their profile:

```sql
INSERT INTO profiles (id, institution_id, role, display_name)
VALUES (
  'THEIR-USER-UUID',
  (SELECT id FROM institutions WHERE slug = 'uok'),
  'response_team',
  'Team Member Name'
);
```

---

## Step 12 — Optional: Add the self-clean cluster check RPC

Add this function to Supabase (SQL Editor) to support the self-clean edge case:

```sql
CREATE OR REPLACE FUNCTION check_high_risk_cluster(
  p_lat FLOAT,
  p_lng FLOAT,
  p_institution_id UUID
)
RETURNS TABLE(risk_score NUMERIC, cluster_id INT) AS $$
BEGIN
  RETURN QUERY
  SELECT c.risk_score, c.cluster_id
  FROM clusters c
  WHERE c.institution_id = p_institution_id
    AND ST_DWithin(
      c.centroid::geometry,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326),
      400
    )
  ORDER BY c.risk_score DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
```

---

## Free Tier Limits Reference

| Service | Free limit | UOK usage estimate |
|---|---|---|
| Supabase DB | 500MB | Easily sufficient for campus |
| Supabase Storage | 1GB | ~200 photos (5MB each) |
| Supabase Auth | Unlimited | — |
| Supabase API requests | Unlimited | — |
| Vercel deploys | Unlimited | — |
| Vercel bandwidth | 100GB/month | Far exceeds campus traffic |
| OpenStreetMap tiles | Unlimited | Free, no key |
| CartoDB Dark tiles | Unlimited | Free, no key |

---

## Troubleshooting

### Map doesn't load
- Check browser console for `Leaflet is not defined` errors
- Ensure `ssr: false` is on the DengueMap dynamic import
- Verify the Leaflet CSS link is in `app/layout.tsx`

### RLS blocking inserts
- Ensure you're using the **service role key** in API routes (not anon key)
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

### Clustering not working
- Verify PostGIS is enabled in Supabase Extensions
- Run `SELECT ST_ClusterDBSCAN(ST_MakePoint(0,0), 1, 1) OVER ();` in SQL Editor — should return 0

### Login redirects to login page again
- Go to Supabase → Auth → URL Configuration
- Make sure your site URL matches your local or production URL exactly

---

## Support

Maintained by the Department of Industrial Management, Faculty of Science, University of Kelaniya.
