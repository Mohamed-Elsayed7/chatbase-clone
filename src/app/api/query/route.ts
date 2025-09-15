// src/app/api/query/route.ts
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { chatbotId, question } = await req.json()

    if (!chatbotId || !question) {
      return NextResponse.json(
        { error: 'Missing chatbotId or question' },
        { status: 400 }
      )
    }

    // Create embedding for the user question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // Call the SQL function in Supabase
    const { data, error } = await supabase.rpc('match_chatbot_chunks', {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    })

    if (error) throw error

    return NextResponse.json({ matches: data })
  } catch (err: any) {
    console.error('Query error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
