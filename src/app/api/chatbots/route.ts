import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

function clientFromToken(
  token: string
): SupabaseClient<Database, "public", "public"> {
  return createClient<Database, "public", "public">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  )
}

export async function GET(req: Request) {
  try {
    // Cookie-based first
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let { data: { user } } = await db.auth.getUser()

    // Bearer fallback
    if (!user) {
      const auth = req.headers.get("authorization") || ""
      const m = auth.match(/^Bearer\s+(.+)$/i)
      if (m) {
        db = clientFromToken(m[1]) as SupabaseClient<Database, "public", any>
        const r = await db.auth.getUser()
        user = r.data.user ?? null
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const admin = getAdminSupabase()
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()
    if (profileErr) throw profileErr

    // Superadmin → all chatbots
    if (profile?.is_superadmin) {
      const { data: chatbots, error } = await admin
        .from("chatbots")
        .select("*")
        .order("created_at", { ascending: false })
      if (error) throw error
      return NextResponse.json({ chatbots })
    }

    // Normal user → RLS restricts to own/org chatbots
    const { data: chatbots, error } = await db
      .from("chatbots")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error

    return NextResponse.json({ chatbots: chatbots ?? [] })
  } catch (err: any) {
    console.error("CHATBOTS GET ERROR:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}
