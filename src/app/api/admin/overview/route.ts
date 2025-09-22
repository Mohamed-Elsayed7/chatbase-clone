import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = getAdminSupabase()

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, plan, created_at, is_superadmin")
    if (usersError) {
      console.error("Supabase profiles fetch error:", usersError)
      return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 })
    }

    const { data: bots, error: botsError } = await supabase
      .from("chatbots")
      .select("id, user_id")
    if (botsError) {
      console.error("Supabase chatbots fetch error:", botsError)
      return NextResponse.json({ error: "Failed to load chatbots" }, { status: 500 })
    }

    const { data: logs, error: logsError } = await supabase
      .from("usage_logs")
      .select("user_id, tokens, type, created_at")
    if (logsError) {
      console.error("Supabase logs fetch error:", logsError)
      return NextResponse.json({ error: "Failed to load usage logs" }, { status: 500 })
    }

    const stats = (users ?? []).map((u) => {
      const userBots = (bots ?? []).filter((b) => b.user_id === u.id)
      const userUsage = (logs ?? []).filter((l) => l.user_id === u.id)
      const totalTokens = userUsage.reduce((sum, l) => sum + (l.tokens || 0), 0)
      return {
        ...u,
        chatbot_count: userBots.length,
        tokens_this_month: totalTokens,
      }
    })

    return NextResponse.json(stats)
  } catch (err: any) {
    console.error("ADMIN OVERVIEW ERROR:", err) // full details only in server logs
    return NextResponse.json(
      { error: "Something went wrong while fetching admin overview" },
      { status: 500 }
    )
  }
}
