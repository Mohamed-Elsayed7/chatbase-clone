import { NextResponse } from "next/server"
import OpenAI from "openai"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase, assertWithinPlanLimit, logUsage } from "@/lib/usage"

export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

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
    const { chatbotId, chatbotKey, messages, retrievedContext, conversationId } = await req.json()

    if ((!chatbotId && !chatbotKey) || !messages) {
      return NextResponse.json(
        { error: "Missing chatbotId/chatbotKey or messages" },
        { status: 400 }
      )
    }

    // 🔐 Authenticate dashboard users
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

    const admin = getAdminSupabase()

    // 🔹 Fetch chatbot: by ID (dashboard) or by public_key (widget)
    let query = admin.from("chatbots").select("id, system_prompt, tone, user_id, is_public")
    if (user && chatbotId) {
      query = query.eq("id", chatbotId)
    } else {
      query = query.eq("public_key", chatbotKey)
    }
    const { data: bot, error: botErr } = await query.maybeSingle()
    if (botErr || !bot) {
      console.error("Chatbot fetch error:", botErr)
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    // 🚫 Block widget access if chatbot is not public
    if (!user && !bot.is_public) {
      return NextResponse.json({ error: "This chatbot is not public" }, { status: 403 })
    }

    // 🔎 Verify conversationId belongs to this bot
    let conversationOk = false
    if (conversationId) {
      const { data: conv, error: convErr } = await admin
        .from("conversations")
        .select("id, chatbot_id")
        .eq("id", conversationId)
        .maybeSingle()
      if (!convErr && conv?.chatbot_id === bot.id) {
        conversationOk = true
      }
    }

    const ownerUserId = bot.user_id

    // ⚖️ Light pre-check
    await assertWithinPlanLimit(admin, ownerUserId, 1000)

    // Context retrieval
    let effectiveContext = retrievedContext as string | undefined
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")
    const queryText = (lastUserMsg?.content || "").toString().trim()

    if (!effectiveContext && queryText) {
      try {
        const emb = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: queryText,
        })
        const queryEmbedding = emb.data[0].embedding

        const { data: matches } = await admin.rpc("match_chatbot_chunks", {
          p_chatbot_id: bot.id,
          p_query_embedding: queryEmbedding as any,
          p_match_count: 5,
        })

        if (matches?.length) {
          effectiveContext = matches.map((m: any) => m.content).join("\n---\n")
        }
      } catch (retrievalErr) {
        console.error("Server-side retrieval error:", retrievalErr)
      }
    }

    // Build system prompt
    const systemPrompt = [
      bot.system_prompt || "You are a helpful assistant.",
      bot.tone ? `Tone: ${bot.tone}` : "",
      effectiveContext ? `Context:\n${effectiveContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    // 🧠 Call OpenAI
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.3,
    })

    const answer = res.choices?.[0]?.message?.content ?? ""
    const totalTokens = res.usage?.total_tokens ?? 0

    // ⚖️ Enforce plan with actual tokens
    await assertWithinPlanLimit(admin, ownerUserId, totalTokens)

    // 💾 Save conversation messages (only widget, not dashboard test chats)
    if (!user && conversationId && conversationOk && lastUserMsg && answer) {
      const { error: saveErr } = await admin.from("conversation_messages").insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: lastUserMsg.content,
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: answer,
        },
      ])
      if (saveErr) console.error("Saving conversation messages failed:", saveErr)

      // 🔹 If conversation has no title yet → set one
      const { data: conv } = await admin
        .from("conversations")
        .select("title")
        .eq("id", conversationId)
        .maybeSingle()

      if (!conv?.title) {
        let newTitle: string
        const nameMatch = lastUserMsg.content.match(/my name is ([a-z]+)/i)
        if (nameMatch) {
          newTitle = nameMatch[1]
        } else {
          newTitle = "Visitor – " + new Date().toLocaleString()
        }

        await admin
          .from("conversations")
          .update({ title: newTitle })
          .eq("id", conversationId)
      }
    }

    // 📊 Log usage
    await logUsage(admin, {
      userId: ownerUserId,
      chatbotId: Number(bot.id),
      type: "chat",
      tokens: totalTokens,
    })

    return NextResponse.json({
      answer,
      usage: res.usage,
      contextUsed: !!effectiveContext,
    })
  } catch (err: any) {
    console.error("CHAT ERROR:", err)
    return NextResponse.json(
      { error: "Something went wrong while processing chat" },
      { status: 500 }
    )
  }
}
