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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const fileId = Number(params.id)
    if (!Number.isFinite(fileId)) {
      return NextResponse.json({ error: "Invalid file id" }, { status: 400 })
    }

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

    // find file
    const { data: fileRow, error: fileErr } = await supabaseClient
      .from("chatbot_files")
      .select("id, file_path")
      .eq("id", fileId)
      .maybeSingle()
    if (fileErr || !fileRow) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // delete from storage
    await admin.storage.from("chatbot-files").remove([fileRow.file_path])

    // delete metadata
    const { error: delErr } = await supabaseClient
      .from("chatbot_files")
      .delete()
      .eq("id", fileId)
    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("chatbot-files DELETE error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
