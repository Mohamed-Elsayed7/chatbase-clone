// src/app/api/organizations/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/supabase";
import { getAdminSupabase } from "@/lib/usage";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const orgId = Number(params.id);
  if (!orgId || Number.isNaN(orgId)) {
    return NextResponse.json({ error: "Invalid organization id" }, { status: 400 });
  }

  const auth = createRouteHandlerClient<Database>({ cookies });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdminSupabase();

  // Ensure caller is a member of this org
  const { data: me, error: meErr } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Fetch org
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, created_at")
    .eq("id", orgId)
    .single();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 400 });

  // Members list (join profiles for names if available)
  const { data: members, error: memErr } = await admin
    .from("organization_members")
    .select("user_id, role, profiles:profiles(first_name, last_name)")
    .eq("organization_id", orgId);

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

  return NextResponse.json({
    ...org,
    members: (members ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      first_name: (m as any).profiles?.first_name ?? null,
      last_name: (m as any).profiles?.last_name ?? null,
    })),
    // helpful for UI permissions
    my_role: me.role,
  });
}
