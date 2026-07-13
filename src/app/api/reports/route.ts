import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ReportSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSelfCleanStatus } from "@/lib/risk-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── 1. Input validation (Zod) ──────────────────────────────
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // ── 2. Rate limiting ────────────────────────────────────────
    const deviceId = request.headers.get("x-device-id") || data.device_id;
    const ip = getClientIp(request);
    const rateResult = checkRateLimit(deviceId, ip);

    if (!rateResult.allowed) {
      const resetSecs = Math.ceil((rateResult.resetMs ?? 60000) / 1000);
      return NextResponse.json(
        {
          error:
            rateResult.reason === "device_limit"
              ? `You've submitted ${5} reports recently. Please wait ${resetSecs} seconds.`
              : "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(resetSecs),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // ── 3. Supabase insert (service role — bypasses RLS safely) ─
    const supabase = await createServiceClient();

    // Look up institution ID
    const { data: institution, error: instErr } = await supabase
      .from("institutions")
      .select("id")
      .eq("slug", data.institution_slug)
      .single();

    if (instErr || !institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 400 });
    }

    // ── 4. Self-clean logic: check cluster risk before deciding status ──
    let initialStatus = "reported";

    if (data.cleaned_by_student) {
      // Check if this pin is inside a high-risk cluster
      const { data: nearbyCluster } = await supabase.rpc("check_high_risk_cluster", {
        p_lat: data.latitude,
        p_lng: data.longitude,
        p_institution_id: institution.id,
      });

      const clusterRisk = nearbyCluster?.risk_score ?? null;
      initialStatus = getSelfCleanStatus(clusterRisk);
    }

    // ── 5. Insert report ────────────────────────────────────────
    const { data: report, error: insertErr } = await supabase
      .from("reports")
      .insert({
        institution_id: institution.id,
        location: `POINT(${data.longitude} ${data.latitude})`,
        category: data.category,
        description: data.description,
        photo_url: data.photo_url,
        status: initialStatus,
        cleaned_by_student: data.cleaned_by_student,
        device_id: data.device_id,
      })
      .select("id, status, created_at")
      .single();

    if (insertErr) {
      console.error("[reports/route] Insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to submit report. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        report: {
          id: report.id,
          status: report.status,
          created_at: report.created_at,
          // Return NO coordinates back to client
        },
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(rateResult.remaining ?? 0),
        },
      }
    );
  } catch (error) {
    console.error("[reports/route] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── GET: public list of reports (sanitized, obfuscated coords) ─
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const institutionSlug = searchParams.get("institution") ?? "uok";

    const { data: institution } = await supabase
      .from("institutions")
      .select("id")
      .eq("slug", institutionSlug)
      .single();

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    const { data: reports, error } = await supabase
      .from("reports")
      .select(
        "id, location_obfuscated, category, status, cluster_id, created_at"
      )
      .eq("institution_id", institution.id)
      .neq("status", "cleaned")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Reports fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("Reports unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
