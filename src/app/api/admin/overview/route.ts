import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = getAdminSupabase()

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, plan, created_at, is_superadmin")
    if (error) throw error

    const { data: bots } = await supabase.from("chatbots").select("id, user_id")
    const { data: logs } = await supabase.from("usage_logs").select("user_id, tokens, type, created_at")

    const stats = (users ?? []).map((u) => {
      const userBots = (bots ?? []).filter(b => b.user_id === u.id)
      const userUsage = (logs ?? []).filter(l => l.user_id === u.id)
      const totalTokens = userUsage.reduce((sum, l) => sum + (l.tokens || 0), 0)
      return {
        ...u,
        chatbot_count: userBots.length,
        tokens_this_month: totalTokens,
      }
    })

    return NextResponse.json(stats)
  } catch (err: any) {
    console.error("ADMIN OVERVIEW ERROR:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}
