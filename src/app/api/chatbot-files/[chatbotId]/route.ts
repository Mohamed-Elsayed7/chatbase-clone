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

async function getUserAndClient(req: Request) {
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
  if (!user) throw new Error("Not authenticated")

  const admin = getAdminSupabase()
  const { data: profile } = await admin
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle()

  
const supabaseClient = (profile?.is_superadmin ? admin : db) as SupabaseClient<Database>

  return { user, supabaseClient, admin }
}

// ✅ GET → list files for a chatbot
export async function GET(req: Request, { params }: { params: { chatbotId: string } }) {
  try {
    const chatbotId = Number(params.chatbotId)
    if (!Number.isFinite(chatbotId)) {
      return NextResponse.json({ error: "Invalid chatbotId" }, { status: 400 })
    }

    const { supabaseClient, admin } = await getUserAndClient(req)

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
    console.error("CHATBOT-FILES GET ERROR:", err)
    return NextResponse.json(
      { error: "Failed to load files" },
      { status: 500 }
    )
  }
}

// ✅ POST → insert metadata for a file (after uploading to storage)
export async function POST(req: Request, { params }: { params: { chatbotId: string } }) {
  try {
    const chatbotId = Number(params.chatbotId)
    if (!Number.isFinite(chatbotId)) {
      return NextResponse.json({ error: "Invalid chatbotId" }, { status: 400 })
    }

    const { supabaseClient } = await getUserAndClient(req)

    const { filePath } = await req.json()
    if (!filePath) {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 })
    }

    const { data, error } = await supabaseClient
      .from("chatbot_files")
      .insert([{ chatbot_id: chatbotId, file_path: filePath }])
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ file: data })
  } catch (err: any) {
    console.error("CHATBOT-FILES POST ERROR:", err)
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    )
  }
}