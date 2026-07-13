import { NextRequest, NextResponse } from "next/server";
import { createAnonServerClient, createServiceClient } from "@/lib/supabase/server";

// Helper to check superadmin status
async function verifySuperadmin() {
  const anonClient = await createAnonServerClient();
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return { allowed: false };

  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") return { allowed: false };
  return { allowed: true, serviceClient };
}

export async function GET() {
  const { allowed, serviceClient } = await verifySuperadmin();
  if (!allowed || !serviceClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: profiles, error } = await serviceClient
      .from("profiles")
      .select("id, role, display_name, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    let mapped = profiles;
    const { data: authUsers, error: authUsersErr } = await serviceClient.auth.admin.listUsers();
    if (!authUsersErr && authUsers.users) {
      mapped = profiles.map(p => {
        const u = authUsers.users.find(u => u.id === p.id);
        return { ...p, email: u?.email };
      });
    }

    return NextResponse.json({ users: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { allowed, serviceClient } = await verifySuperadmin();
  if (!allowed || !serviceClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { email, password, displayName, role } = await req.json();

    // 1. Create auth user
    const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authErr) throw authErr;

    // 2. Insert into profiles (will fail if trigger already creates it, so we use upsert)
    const { error: profileErr } = await serviceClient
      .from("profiles")
      .upsert({
        id: authData.user.id,
        role: role || "response_team",
        display_name: displayName,
      });

    if (profileErr) throw profileErr;

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const { allowed, serviceClient } = await verifySuperadmin();
  if (!allowed || !serviceClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, password, role, displayName } = await req.json();

    if (password) {
      const { error } = await serviceClient.auth.admin.updateUserById(id, { password });
      if (error) throw error;
    }

    if (role || displayName) {
      const updates: any = {};
      if (role) updates.role = role;
      if (displayName) updates.display_name = displayName;
      const { error } = await serviceClient.from("profiles").update(updates).eq("id", id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { allowed, serviceClient } = await verifySuperadmin();
  if (!allowed || !serviceClient) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    const { error } = await serviceClient.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
