import { NextResponse } from "next/server"
import { getAdminSupabase } from "@/lib/usage"

export async function GET(
  _req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = getAdminSupabase()
    const userId = params.userId

    const { data: user, error: userErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, plan, created_at, is_superadmin")
      .eq("id", userId)
      .maybeSingle()
    if (userErr) throw userErr

    const { data: bots } = await supabase
      .from("chatbots")
      .select("id, name, created_at, organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    const { data: logs } = await supabase
      .from("usage_logs")
      .select("tokens, type, created_at")
      .eq("user_id", userId)

    const usageMap: Record<string, { date: string; tokens: number; chats: number }> = {}
    for (const row of logs ?? []) {
      if (!row.created_at) continue
      const dateKey = new Date(row.created_at as string).toISOString().slice(0, 10)
      if (!usageMap[dateKey]) usageMap[dateKey] = { date: dateKey, tokens: 0, chats: 0 }
      usageMap[dateKey].tokens += row.tokens || 0
      if (row.type === "chat") usageMap[dateKey].chats += 1
    }
    const usageOverTime = Object.values(usageMap).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ user, bots, usageOverTime })
  }  catch (err: any) {
    console.error("ADMIN USER ERROR:", err)
    return NextResponse.json(
      { error: "Failed to load user data" },
      { status: 500 }
    )
  }
}