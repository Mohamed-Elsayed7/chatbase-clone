import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { getAdminSupabase } from "@/lib/usage"
import type { Database } from "@/types/supabase"

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )
}

// ✅ Fetch messages of a conversation
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = getAdminSupabase()

    const { data: messages, error } = await admin
      .from("conversation_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", params.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }) // ✅ stable ordering

    if (error) throw error

    return NextResponse.json({ messages: messages ?? [] })
  } catch (err: any) {
    console.error("CONVERSATION FETCH ERROR:", err)
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    )
  }
}

// ✅ Delete conversation
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id
    if (!conversationId) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 })
    }

    // Try cookie-based session
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let { data: { user } } = await db.auth.getUser()

    // Fallback to Bearer token
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

    // ✅ Check conversation exists and belongs to chatbot
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, chatbot_id")
      .eq("id", conversationId)
      .maybeSingle()

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // ✅ Superadmin bypass, otherwise enforce access with RLS
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_superadmin) {
      const { data: chatbot } = await db
        .from("chatbots")
        .select("id")
        .eq("id", conv.chatbot_id)
        .maybeSingle()

      if (!chatbot) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // ✅ Delete conversation (messages cascade via FK)
    const { error: delErr } = await admin
      .from("conversations")
      .delete()
      .eq("id", conversationId)

    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("DELETE CONVERSATION ERROR:", err)
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    )
  }
}

// ✅ Rename conversation (set/update title)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const conversationId = params.id
    const { title } = await req.json().catch(() => ({}))

    if (!conversationId || !title || !title.trim()) {
      return NextResponse.json({ error: "Missing id or title" }, { status: 400 })
    }

    // Try cookie-based session
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let { data: { user } } = await db.auth.getUser()

    // Fallback to Bearer token
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

    // ✅ Check conversation
    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .select("id, chatbot_id")
      .eq("id", conversationId)
      .maybeSingle()

    if (convErr || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // ✅ Superadmin bypass, otherwise enforce access
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.is_superadmin) {
      const { data: chatbot } = await db
        .from("chatbots")
        .select("id")
        .eq("id", conv.chatbot_id)
        .maybeSingle()

      if (!chatbot) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // ✅ Update title
    const { error: updErr } = await admin
      .from("conversations")
      .update({ title })
      .eq("id", conversationId)

    if (updErr) throw updErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("PATCH CONVERSATION ERROR:", err)
    return NextResponse.json(
      { error: "Failed to rename conversation" },
      { status: 500 }
    )
  }
}
