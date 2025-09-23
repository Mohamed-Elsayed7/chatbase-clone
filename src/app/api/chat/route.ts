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
    const { chatbotId, messages, retrievedContext } = await req.json()

    if (!chatbotId || !messages) {
      return NextResponse.json(
        { error: "Missing chatbotId or messages" },
        { status: 400 }
      )
    }

    // Try to authenticate user (dashboard mode)
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

    // Fetch chatbot (use admin to bypass RLS for widget mode)
    const { data: bot, error: botErr } = await admin
      .from("chatbots")
      .select("system_prompt, tone, user_id")
      .eq("id", chatbotId)
      .maybeSingle()

    if (botErr || !bot) {
      console.error("Chatbot fetch error:", botErr)
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    const ownerUserId = bot.user_id

    // Pre-check plan
    await assertWithinPlanLimit(admin, ownerUserId, 1000)

    // If no retrievedContext provided (widget), do server-side retrieval
    let effectiveContext = retrievedContext as string | undefined
    if (!effectiveContext) {
      try {
        // Find latest user message content
        const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")
        const queryText = (lastUserMsg?.content || "").toString().trim()

        if (queryText) {
          // Create query embedding
          const emb = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: queryText,
          })
          const queryEmbedding = emb.data[0].embedding

          // Match against stored chunks
          const { data: matches, error: matchErr } = await admin.rpc("match_chatbot_chunks", {
            p_chatbot_id: chatbotId,
            p_query_embedding: queryEmbedding as any,
            p_match_count: 5,
          })
          if (matchErr) {
            console.error("Vector match RPC error:", matchErr)
          } else if (matches?.length) {
            effectiveContext = matches.map((m: any) => m.content).join("\n---\n")
          }
        }
      } catch (retrievalErr) {
        console.error("Server-side retrieval error:", retrievalErr)
        // Continue without context if retrieval fails
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

    // Call OpenAI
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.3,
    })

    const answer = res.choices?.[0]?.message?.content ?? ""
    const totalTokens = res.usage?.total_tokens ?? 0

    // Enforce plan with actual tokens
    await assertWithinPlanLimit(admin, ownerUserId, totalTokens)

    // Log usage against the chatbot owner (works for both dashboard & widget)
    await logUsage(admin, {
      userId: ownerUserId,
      chatbotId: Number(chatbotId),
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
