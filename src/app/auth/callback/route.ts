import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard/triage";

  const authError = searchParams.get("error_description") || searchParams.get("error");
  if (authError) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(authError)}`);
  }

  if (code) {
    const supabase = await createServiceClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
