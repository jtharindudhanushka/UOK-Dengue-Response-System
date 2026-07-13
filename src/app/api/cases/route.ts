import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { CaseSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA"; // Default to testing secret

async function verifyTurnstile(token: string) {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `secret=${encodeURIComponent(TURNSTILE_SECRET)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[Turnstile] Verification error:", err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── 1. Validate input ──────────────────────────────────────
    const parsed = CaseSchema.safeParse(body);
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
      return NextResponse.json(
        { error: "Too many submissions. Please wait before submitting again." },
        { status: 429 }
      );
    }

    // ── 2.5 Verify Turnstile Captcha ────────────────────────────
    const isValidCaptcha = await verifyTurnstile(data.turnstile_token);
    if (!isValidCaptcha) {
      return NextResponse.json(
        { error: "Security check failed. Please try submitting again." },
        { status: 403 }
      );
    }

    // ── 3. Insert with service role ────────────────────────────
    const supabase = await createServiceClient();

    const { data: institution } = await supabase
      .from("institutions")
      .select("id")
      .eq("slug", data.institution_slug)
      .single();

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 400 });
    }

    const { error: insertErr } = await supabase.from("cases").insert({
      institution_id: institution.id,
      location: `POINT(${data.longitude} ${data.latitude})`,
      student_name: data.student_name,
      student_number: data.student_number,
      contact_number: data.contact_number,
      consent_given: data.consent_given,
      notes: data.notes,
      device_id: data.device_id,
    });

    if (insertErr) {
      console.error("[cases/route] Insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to submit case. Please try again." },
        { status: 500 }
      );
    }

    // Return no location data back to client
    return NextResponse.json(
      { success: true, message: "Thank you for reporting. Stay safe." },
      { status: 201 }
    );
  } catch (error) {
    console.error("[cases/route] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
