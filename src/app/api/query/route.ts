import { NextResponse } from "next/server"
import OpenAI from "openai"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase, assertWithinPlanLimit, logUsage } from "@/lib/usage"

export const dynamic = "force-dynamic"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )
}

export async function POST(req: Request) {
  try {
    const { chatbotId, query, matchCount = 5 } = await req.json()

    if (!chatbotId || !query) {
      return NextResponse.json(
        { error: "Missing chatbotId or query" },
        { status: 400 }
      )
    }

    // 🔐 Authenticate
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let {
      data: { user },
    } = await db.auth.getUser()

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

    // 🔐 Check superadmin
    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    const supabaseClient = profile?.is_superadmin ? admin : db

    // ✅ Fetch chatbot to get userId
    const { data: bot, error: botErr } = await (supabaseClient as any)
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotId)
      .maybeSingle()

    if (botErr || !bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }
    const userId = bot.user_id

    // ✅ Create embedding for user query
    const emb = await openai.embeddings.create({
      model: "text-embedding-ada-002", // 1536 dims, matches DB
      input: query,
    })
    const queryEmbedding = emb.data[0].embedding

    // ✅ Enforce plan (light pre-check)
    await assertWithinPlanLimit(admin, userId, 0)

    // ✅ Run match RPC (service role needed because it uses pgvector RPC)
    const { data, error } = await admin.rpc("match_chatbot_chunks", {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding as any, // 👈 pgvector typing workaround
      p_match_count: matchCount,
    })

    if (error) throw error

    // ✅ Log query
    await logUsage(admin, {
      userId,
      chatbotId: Number(chatbotId),
      type: "query",
      tokens: 0,
    })

    return NextResponse.json({ matches: data || [] })
  } catch (err: any) {
    console.error("QUERY ERROR:", err.message)
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: err?.status || 500 }
    )
  }
}
