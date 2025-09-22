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

    // 🔐 Authenticate user (cookie first, then Bearer fallback)
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

    // 🔐 Check if superadmin
    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    const supabaseClient = getAdminSupabase() as SupabaseClient<Database, "public">

    // ✅ Fetch chatbot settings + userId for usage tracking
    const { data: bot, error: botErr } = await supabaseClient
      .from("chatbots")
      .select("system_prompt, tone, user_id")
      .eq("id", chatbotId)
      .maybeSingle()

    if (botErr || !bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    const userId = bot.user_id

    // ✅ Light pre-check to avoid waste if way over cap
    await assertWithinPlanLimit(admin, userId, 1000)

    // ✅ Build system prompt
    const systemPrompt = [
      bot.system_prompt || "You are a helpful assistant.",
      bot.tone ? `Tone: ${bot.tone}` : "",
      retrievedContext ? `Context:\n${retrievedContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    // ✅ OpenAI completion
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.3,
    })

    const answer = res.choices?.[0]?.message?.content ?? ""
    const totalTokens = res.usage?.total_tokens ?? 0

    // ✅ Enforce plan with actual token count
    await assertWithinPlanLimit(admin, userId, totalTokens)

    // ✅ Log usage
    await logUsage(admin, {
      userId,
      chatbotId: Number(chatbotId),
      type: "chat",
      tokens: totalTokens,
    })

    return NextResponse.json({
      answer,
      usage: res.usage,
      contextUsed: !!retrievedContext,
    })
  } catch (err: any) {
    console.error("CHAT ERROR:", err)
    return NextResponse.json(
      { error: "Something went wrong while processing chat" },
      { status: 500 }
    )
  }
}
