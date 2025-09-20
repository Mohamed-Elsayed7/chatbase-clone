// src/app/api/organizations/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "@/lib/usage";

export async function GET() {
  const auth = createRouteHandlerClient<Database>({ cookies });
  const { data: { user }, error: authErr } = await auth.auth.getUser();
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // List orgs current user belongs to
  const { data, error } = await admin
    .from("organization_members")
    .select("organization_id, role, organizations:organizations(id, name, created_at)")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const orgs = (data ?? []).map((m) => ({
    id: m.organizations?.id,
    name: m.organizations?.name,
    created_at: m.organizations?.created_at,
    role: m.role,
  })).filter(Boolean);

  return NextResponse.json(orgs);
}

export async function POST(req: Request) {
  const auth = createRouteHandlerClient<Database>({ cookies });
  const { data: { user }, error: authErr } = await auth.auth.getUser();
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Create org
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name })
    .select("*")
    .single();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });

  // Add creator as owner
  const { error: memErr } = await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: user.id, role: "owner" });

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  return NextResponse.json(org);
}
