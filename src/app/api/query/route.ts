import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// ✅ Use service role client → bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    const { chatbotId, question } = await req.json()
    if (!chatbotId || !question) {
      return NextResponse.json({ error: "Missing chatbotId or question" }, { status: 400 })
    }

    // 1. Embed the question
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question
    })
    const queryEmbedding = emb.data[0].embedding

    // 2. Query DB with match function
    const { data, error } = await supabase.rpc("match_chatbot_chunks", {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5
    })

    if (error) throw error

    return NextResponse.json({ matches: data })
  } catch (err: any) {
    console.error("Query error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
