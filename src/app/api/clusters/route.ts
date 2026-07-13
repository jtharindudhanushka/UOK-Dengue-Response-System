import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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

    const { data: clusters, error } = await supabase
      .from("api_clusters_view")
      .select("*")
      .eq("institution_id", institution.id)
      .order("risk_score", { ascending: false });

    if (error) {
      console.error("Clusters fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch clusters" }, { status: 500 });
    }

    return NextResponse.json({ clusters: clusters ?? [] });
  } catch (err) {
    console.error("Clusters unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
