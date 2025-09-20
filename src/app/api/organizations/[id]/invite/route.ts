// src/app/api/organizations/[id]/invite/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "@/lib/usage";

type Role = "member" | "admin";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const orgId = Number(params.id);
  if (!orgId || Number.isNaN(orgId)) {
    return NextResponse.json({ error: "Invalid organization id" }, { status: 400 });
  }

  const auth = createRouteHandlerClient<Database>({ cookies });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, role } = await req.json().catch(() => ({})) as { email?: string; role?: Role };
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  const targetRole: Role = role === "admin" ? "admin" : "member";

  const admin = getAdminSupabase();

  // Ensure caller is owner/admin of this org
  const { data: me, error: meErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (!me || !["owner", "admin"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find user by email via Admin API (service role)
  // NOTE: supabase-js v2 doesn't have getUserByEmail; we list and filter (fine at small scale).
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 });

  const found = list.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) {
    return NextResponse.json({ error: "User not found. Ask them to sign up first." }, { status: 404 });
  }

  // Check if already a member
  const { data: exists, error: existErr } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", found.id)
    .maybeSingle();

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 400 });
  if (exists) return NextResponse.json({ ok: true, message: "User already a member" });

  // Insert membership
  const { error: insErr } = await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: found.id, role: targetRole });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
