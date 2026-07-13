import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ResolveSchema } from "@/lib/validations";

// ── PATCH /api/reports/[id] ─────────────────────────────────────────────
// Two modes:
//   1. Authenticated team member resolving a report (after_photo_url / notes)
//   2. Anonymous public volunteer self-clean (volunteer_clean: true)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createServiceClient();

    // ── Mode 1: Public volunteer self-clean ────────────────────────
    if (body.volunteer_clean === true) {
      const deviceId = request.headers.get("X-Device-ID") ?? body.device_id ?? "";

      if (!deviceId || deviceId.length < 10) {
        return NextResponse.json({ error: "Device ID required." }, { status: 400 });
      }

      // Fetch the report — only allow if it's still in 'reported' status
      const { data: report, error: fetchErr } = await supabase
        .from("reports")
        .select("id, status, cluster_id, institution_id")
        .eq("id", id)
        .eq("status", "reported")
        .single();

      if (fetchErr || !report) {
        return NextResponse.json(
          { error: "This site has already been assigned or cleaned." },
          { status: 409 }
        );
      }

      // Check if the cluster risk is high — if so, require team verification
      let requiresVerification = false;
      if (report.cluster_id) {
        const { data: cluster } = await supabase
          .from("clusters")
          .select("risk_score, risk_level")
          .eq("cluster_id", report.cluster_id)
          .eq("institution_id", report.institution_id)
          .single();

        requiresVerification = cluster
          ? cluster.risk_score >= 8 || cluster.risk_level === "high" || cluster.risk_level === "critical"
          : false;
      }

      const newStatus = requiresVerification ? "pending_verification" : "cleaned";

      const { data: updated, error: updateErr } = await supabase
        .from("reports")
        .update({
          status: newStatus,
          cleaned_by_student: true,
          resolved_at: newStatus === "cleaned" ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("id, status")
        .single();

      if (updateErr || !updated) {
        return NextResponse.json({ error: "Failed to update report." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        status: newStatus,
        requires_verification: requiresVerification,
        message: requiresVerification
          ? "Thank you. This is a high-risk zone — a response team member will verify your cleanup."
          : "Thank you! Site marked as cleaned.",
      });
    }

    // ── Mode 2: Authenticated team resolve ─────────────────────────
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = ResolveSchema.safeParse({ report_id: id, ...body });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const { data: updated, error } = await supabase
      .from("reports")
      .update({
        status: "cleaned",
        after_photo_url: data.after_photo_url,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("assigned_to", user.id)
      .select("id, status, resolved_at")
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: "Report not found or you are not the assignee." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, report: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PUT /api/reports/[id] — Assign cluster to self ──────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServiceClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: reports, error } = await supabase
      .from("reports")
      .update({
        status: "assigned",
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq("cluster_id", parseInt(id))
      .eq("status", "reported")
      .select("id");

    if (error) {
      return NextResponse.json({ error: "Failed to assign cluster" }, { status: 500 });
    }

    return NextResponse.json({ success: true, assigned: reports?.length ?? 0 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
