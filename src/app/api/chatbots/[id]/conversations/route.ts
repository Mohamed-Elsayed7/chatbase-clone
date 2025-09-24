import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const chatbotId = Number(params.id)
    if (!Number.isFinite(chatbotId)) {
      return NextResponse.json({ error: "Invalid chatbot id" }, { status: 400 })
    }

    // Try cookie-based session first
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let { data: { user } } = await db.auth.getUser()

    // Fallback: Bearer token
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

    // Superadmin bypass
    const admin = getAdminSupabase()
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()
    if (profileErr) throw profileErr

    if (profile?.is_superadmin) {
      const { data, error } = await admin
        .from("conversations")
        .select("id, created_at")
        .eq("chatbot_id", chatbotId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return NextResponse.json({ conversations: data ?? [] })
    }

    // Normal user → let RLS enforce chatbot access, but we need to ensure they own/have access
    const { data: chatbot, error: botErr } = await db
      .from("chatbots")
      .select("id")
      .eq("id", chatbotId)
      .maybeSingle()
    if (botErr) throw botErr
    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    // Fetch conversations for this chatbot
    const { data, error } = await db
      .from("conversations")
      .select("id, created_at")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false })
    if (error) throw error

    return NextResponse.json({ conversations: data ?? [] })
  } catch (err: any) {
    console.error("CHATBOT CONVERSATIONS ERROR:", err)
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
  }
}
