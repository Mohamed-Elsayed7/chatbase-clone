import { NextResponse } from "next/server"
import OpenAI from "openai"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { createClient, SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { getAdminSupabase } from "@/lib/usage"

function chunkText(text: string, chunkSize = 1000): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  let current: string[] = []

  for (const word of words) {
    current.push(word)
    if (current.join(" ").length > chunkSize) {
      chunks.push(current.join(" "))
      current = []
    }
  }
  if (current.length > 0) chunks.push(current.join(" "))
  return chunks
}

function clientFromToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request) {
  try {
    const { chatbotId, fileId, text } = await req.json()

    if (!chatbotId || !fileId || !text) {
      return NextResponse.json(
        { error: "Missing chatbotId, fileId, or text" },
        { status: 400 }
      )
    }

    // 🔐 Authenticate
    const cookieStore = cookies()
    let db = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    let {
      data: { user },
    } = await db.auth.getUser()

    if (!user) {
      const auth = req.headers.get("authorization") || ""
      const m = auth.match(/^Bearer\s+(.+)$/i)
      if (m) {
        db = clientFromToken(m[1]) as SupabaseClient<Database, "public", any>
        const r = await db.auth.getUser()
        user = r.data.user ?? null
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    // 🔐 Check if superadmin
    const admin = getAdminSupabase()
    const { data: profile } = await admin
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle()

    const supabaseClient = profile?.is_superadmin ? admin : db

    // ✅ Ensure chatbot exists and is accessible
    const { data: bot, error: botErr } = await (supabaseClient as any)
      .from("chatbots")
      .select("id, user_id")
      .eq("id", chatbotId)
      .maybeSingle()
    if (botErr || !bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    // ✅ Generate embeddings
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const chunks = chunkText(text)

    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      })

      const embedding = embeddingResponse.data[0].embedding

      const { error } = await admin.from("chatbot_embeddings").insert([
        {
          chatbot_id: Number(chatbotId),
          file_id: Number(fileId),
          content: chunk,
          embedding,
        },
      ])
      if (error) throw error
    }

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err: any) {
    console.error("Embedding API error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
