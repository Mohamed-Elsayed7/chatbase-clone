import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export async function POST(req: Request) {
  try {
    const { chatbotKey } = await req.json().catch(() => ({}))

    if (!chatbotKey) {
      return NextResponse.json({ error: "Missing chatbotKey" }, { status: 400 })
    }

    const admin = getAdminSupabase()

    // Find the chatbot by its public key; must be public for widget usage
    const { data: bot, error: botErr } = await admin
      .from("chatbots")
      .select("id, is_public")
      .eq("public_key", chatbotKey)
      .maybeSingle()

    if (botErr) {
      console.error("CONVERSATION CREATE / chatbot fetch error:", botErr)
      return NextResponse.json({ error: "Failed to locate chatbot" }, { status: 500 })
    }

    if (!bot || !bot.is_public) {
      return NextResponse.json({ error: "Chatbot not found or not public" }, { status: 404 })
    }

    const { data: conv, error: convErr } = await admin
      .from("conversations")
      .insert({ chatbot_id: bot.id })
      .select("id")
      .maybeSingle()

    if (convErr || !conv) {
      console.error("CONVERSATION CREATE / insert error:", convErr)
      return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 })
    }

    return NextResponse.json({ conversationId: conv.id })
  } catch (err) {
    console.error("CONVERSATION CREATE ERROR:", err)
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 })
  }
}
