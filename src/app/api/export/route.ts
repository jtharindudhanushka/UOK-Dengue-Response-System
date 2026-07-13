import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();

    // Verify authenticated session
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify superadmin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, institution_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all cleaned reports with full details
    const { data: reports, error } = await supabase
      .from("reports")
      .select(
        "id, category, status, created_at, assigned_at, resolved_at, cluster_id, cleaned_by_student"
      )
      .eq("institution_id", profile.institution_id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Build CSV
    const headers = [
      "id",
      "category",
      "status",
      "cluster_id",
      "cleaned_by_student",
      "created_at",
      "assigned_at",
      "resolved_at",
    ];

    const rows = (reports ?? []).map((r) =>
      headers.map((h) => {
        const val = (r as Record<string, unknown>)[h];
        return val != null ? `"${String(val).replace(/"/g, '""')}"` : "";
      }).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="uok-drs-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
