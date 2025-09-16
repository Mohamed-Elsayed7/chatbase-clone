import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Service Role Key is missing')
}

const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const { chatbotId, question } = await req.json()
    if (!chatbotId || !question) {
      return NextResponse.json(
        { error: 'Missing chatbotId or question' },
        { status: 400 }
      )
    }

    // 1. Embed question
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    })
    const queryEmbedding = emb.data[0].embedding

    // 2. Query top 5 chunks
    const { data: matches, error } = await supabase.rpc('match_chatbot_chunks', {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    })
    if (error) throw error

    // 3. Build context string
    const context = (matches || []).map((m: any) => m.content).join('\n\n')

    // 4. Ask OpenAI with context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-3.5-turbo if cheaper
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Use the provided context to answer. ' +
            "If the answer is not in the context, reply: 'I don’t know based on the documents.'",
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    })

    const answer =
      completion.choices[0].message?.content || 'No answer generated.'

    return NextResponse.json({ answer, context })
  } catch (err: any) {
    console.error('Chat error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
