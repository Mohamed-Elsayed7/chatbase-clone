import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { chatbotId: string } }
) {
  try {
    const chatbotId = Number(params.chatbotId)
    if (!chatbotId || Number.isNaN(chatbotId)) {
      return NextResponse.json({ error: "Invalid chatbotId" }, { status: 400 })
    }

    const supabase = getAdminSupabase()

    const [filesRes, embRes, logsRes] = await Promise.all([
      supabase.from("chatbot_files").select("id", { count: "exact", head: true }).eq("chatbot_id", chatbotId),
      supabase.from("chatbot_embeddings").select("id", { count: "exact", head: true }).eq("chatbot_id", chatbotId),
      supabase.from("usage_logs").select("id, created_at, type, tokens").eq("chatbot_id", chatbotId).order("created_at", { ascending: true })
    ])

    if (filesRes.error) throw filesRes.error
    if (embRes.error) throw embRes.error
    if (logsRes.error) throw logsRes.error

    const totalFiles = filesRes.count ?? 0
    const totalEmbeddings = embRes.count ?? 0

    let totalTokens = 0
    let totalChats = 0

    const usageMap: Record<string, { date: string; tokens: number; chats: number }> = {}

    for (const row of logsRes.data || []) {
        if (!row.created_at) continue // 👈 skip if null
        const createdAt = new Date(row.created_at as string)
        const dateKey = createdAt.toISOString().slice(0, 10)

        if (!usageMap[dateKey]) {
            usageMap[dateKey] = { date: dateKey, tokens: 0, chats: 0 }
        }
        usageMap[dateKey].tokens += row.tokens || 0
        if (row.type === "chat") usageMap[dateKey].chats += 1

        totalTokens += row.tokens || 0
        if (row.type === "chat") totalChats += 1
    }

    const usageOverTime = Object.values(usageMap).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      totalChats,
      totalTokens,
      totalFiles,
      totalEmbeddings,
      usageOverTime,
    })
  } catch (err: any) {
    console.error("ANALYTICS ERROR:", err)
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    )
  }
}