import { NextResponse } from "next/server"
import OpenAI from "openai"
import { getAdminSupabase, assertWithinPlanLimit, logUsage } from "@/lib/usage"

export const dynamic = "force-dynamic"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(req: Request) {
  try {
    const { chatbotId, messages, retrievedContext } = await req.json()

    if (!chatbotId || !messages) {
      return NextResponse.json(
        { error: "Missing chatbotId or messages" },
        { status: 400 }
      )
    }

    const admin = getAdminSupabase()

    // ✅ Fetch chatbot settings + userId for usage tracking
    const { data: bot, error: botErr } = await admin
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
      contextUsed: !!retrievedContext, // helpful for debugging
    })
  } catch (err: any) {
    console.error("CHAT ERROR:", err.message)
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: err?.status || 500 }
    )
  }
}
