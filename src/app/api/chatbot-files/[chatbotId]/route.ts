import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase } from "@/lib/usage"

export const dynamic = "force-dynamic"

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request, { params }: { params: { chatbotId: string } }) {
  try {
    const chatbotId = Number(params.chatbotId)
    if (!Number.isFinite(chatbotId)) {
      return NextResponse.json({ error: "Invalid chatbotId" }, { status: 400 })
    }

    // authenticate
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let { data: { user } } = await db.auth.getUser()
    if (!user) {
      const auth = req.headers.get("authorization") || ""
      const m = auth.match(/^Bearer\s+(.+)$/i)
      if (m) {
        db = clientFromToken(m[1]) as SupabaseClient<Database, "public", any>
        const r = await db.auth.getUser()
        user = r.data.user ?? null
      }
    }
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    const supabaseClient = (profile?.is_superadmin ? admin : db) as SupabaseClient<Database>

    const { data: files, error: filesErr } = await supabaseClient
      .from("chatbot_files")
      .select("id, file_path, created_at")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false })

    if (filesErr) throw filesErr

    const filesWithUrls = await Promise.all(
      (files || []).map(async (f) => {
        const { data: urlData } = await admin.storage
          .from("chatbot-files")
          .createSignedUrl(f.file_path, 60 * 60)
        return { ...f, signedUrl: urlData?.signedUrl ?? null }
      })
    )

    return NextResponse.json({ files: filesWithUrls })
  } catch (err: any) {
    console.error("chatbot-files GET error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
