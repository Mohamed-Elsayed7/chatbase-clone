import { createClient } from "@supabase/supabase-js"

export const PLAN_LIMITS: Record<string, number> = {
  free: 50_000,         // 50k tokens/month
  pro: 1_000_000,       // 1M tokens/month
  enterprise: Infinity, // practically unlimited
}

// ✅ Service role client (bypasses RLS)
export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ) as any // loosen typing for now
}

// ✅ Current month window
export function getCurrentMonthWindow() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0))
  return { start, end }
}

// ✅ Get user plan
type ProfileRow = { plan: string | null }

export async function getUserPlan(
  admin: ReturnType<typeof createClient>,
  userId: string
) {
  const { data, error } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single<ProfileRow>() // 👈 tell TS the shape

  if (error) throw error
  return (data?.plan || "free").toLowerCase()
}

// ✅ Get monthly usage
export async function getUserMonthUsage(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<number> {
  const { start, end } = getCurrentMonthWindow()

  const { data, error } = await admin
    .from("usage_logs")
    .select("tokens")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())

  if (error) throw error
  return (data || []).reduce((sum, row) => sum + (row.tokens || 0), 0)
}

// ✅ Enforce plan limits
export async function assertWithinPlanLimit(
  admin: ReturnType<typeof createClient>,
  userId: string,
  tokensToAdd: number
) {
  const plan = await getUserPlan(admin, userId)
  const cap = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  if (cap === Infinity) return

  const used = await getUserMonthUsage(admin, userId)
  if (used + tokensToAdd > cap) {
    const remaining = Math.max(cap - used, 0)
    const message =
      remaining === 0
        ? `Monthly token limit reached for your ${plan} plan.`
        : `This action needs ~${tokensToAdd} tokens but you have only ~${remaining} left this month on your ${plan} plan.`
    const err = new Error(message)
    ;(err as any).status = 402
    throw err
  }
}

// ✅ Log usage
export async function logUsage(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string
    chatbotId?: number | null
    type: "embed" | "chat" | "query"
    tokens: number
  }
) {
  const { error } = await admin.from("usage_logs").insert({
    user_id: params.userId,
    chatbot_id: params.chatbotId ?? null,
    type: params.type,
    tokens: params.tokens,
  })
  if (error) throw error
}

/* ---------- Token Estimation Helpers ---------- */

// Simple heuristic: ~4 characters ≈ 1 token
export async function countTokens(text: string): Promise<number> {
  return Math.ceil(text.length / 4)
}

// For arrays of chunks
export async function countTokensForArray(texts: string[]): Promise<number> {
  let total = 0
  for (const t of texts) total += await countTokens(t)
  return total
}
