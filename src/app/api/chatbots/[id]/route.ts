import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { getAdminSupabase } from "@/lib/usage"
import type { Database } from "@/types/supabase"

export const dynamic = "force-dynamic"

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
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

async function getUser(req: Request) {
  const cookieStore = cookies()
  let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
  let { data: { user } } = await db.auth.getUser()

  if (!user) {
    const auth = req.headers.get("authorization") || ""
    const m = auth.match(/^Bearer\s+(.+)$/i)
    if (m) {
      db = clientFromToken(m[1]) as SupabaseClient<Database, "public", any>
      const r = await db.auth.getUser()
      user = r.data.user ?? null
    }
  }

  return { db, user }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const { db, user } = await getUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_superadmin) {
      const { data: chatbot, error } = await admin
        .from("chatbots")
        .select("*")
        .eq("id", id)
        .maybeSingle()
      if (error) throw error
      if (!chatbot) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(chatbot)
    }

    // Normal user (RLS applies)
    const { data: chatbot, error } = await db
      .from("chatbots")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!chatbot) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(chatbot)
  } catch (err: any) {
    console.error("CHATBOT DETAIL ERROR:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const body = await req.json()
    const { db, user } = await getUser(req)
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_superadmin) {
      // Superadmin bypass → service role
      const { error: updateErr } = await admin.from("chatbots").update(body).eq("id", id)
      if (updateErr) throw updateErr
      return NextResponse.json({ success: true })
    }

    // Normal user (RLS applies)
    const { error: updateErr } = await db.from("chatbots").update(body).eq("id", id)
    if (updateErr) throw updateErr
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("CHATBOT UPDATE ERROR:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}
