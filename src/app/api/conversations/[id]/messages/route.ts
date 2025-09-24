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
    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
    }

    // Try cookie-based session
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
        .from("conversation_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }) // ✅ fix wrong ordering
      if (error) throw error
      return NextResponse.json({ messages: data ?? [] })
    }

    // Normal user → first validate they own this chatbot
    const { data: conv, error: convErr } = await db
      .from("conversations")
      .select("chatbot_id")
      .eq("id", conversationId)
      .maybeSingle()
    if (convErr) throw convErr
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Fetch messages
    const { data, error } = await db
      .from("conversation_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }) // ✅ fix wrong ordering
    if (error) throw error

    return NextResponse.json({ messages: data ?? [] })
  } catch (err: any) {
    console.error("CONVERSATION MESSAGES ERROR:", err)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}
