import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = getAdminSupabase()
    const userId = params.userId

    // profile
    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, plan, created_at, is_admin")
      .eq("id", userId)
      .single()
    if (userErr) throw userErr

    // bots
    const { data: bots, error: botErr } = await supabase
      .from("chatbots")
      .select("id, name, created_at")
      .eq("user_id", userId)
    if (botErr) throw botErr

    // usage
    const { data: logs, error: logErr } = await supabase
      .from("usage_logs")
      .select("created_at, type, tokens")
      .eq("user_id", userId)
    if (logErr) throw logErr

    const usageMap: Record<string, { date: string; tokens: number; chats: number }> = {}
    for (const row of logs || []) {
      if (!row.created_at) continue
      const dateKey = new Date(row.created_at as string).toISOString().slice(0, 10)
      if (!usageMap[dateKey]) usageMap[dateKey] = { date: dateKey, tokens: 0, chats: 0 }
      usageMap[dateKey].tokens += row.tokens || 0
      if (row.type === "chat") usageMap[dateKey].chats += 1
    }
    const usageOverTime = Object.values(usageMap).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ user, bots, usageOverTime })
  } catch (err: any) {
    console.error("ADMIN USER ERROR:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}
