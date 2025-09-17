import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getAdminSupabase, assertWithinPlanLimit, logUsage } from "@/lib/usage"

export const dynamic = "force-dynamic"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const { chatbotId, query, matchCount = 5 } = await req.json()

    if (!chatbotId || !query) {
      return NextResponse.json(
        { error: "Missing chatbotId or query" },
        { status: 400 }
      )
    }

    const admin = getAdminSupabase()

    // ✅ Fetch chatbot to get userId
    const { data: bot, error: botErr } = await admin
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotId)
      .single()

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

    // ✅ Enforce plan (light, before DB call)
    await assertWithinPlanLimit(admin, userId, 0)

    // ✅ Run match RPC
    const { data, error } = await admin.rpc("match_chatbot_chunks", {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding as any, // 👈 bypass TS, pgvector still works
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
