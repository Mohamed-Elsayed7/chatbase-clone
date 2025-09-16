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
    const { chatbotId, messages } = await req.json()

    if (!chatbotId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing chatbotId or messages[]' },
        { status: 400 }
      )
    }

    // Latest user message
    const userMsg = messages[messages.length - 1]?.content || ''

    // 1. Embed last user question
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userMsg,
    })
    const queryEmbedding = emb.data[0].embedding

    // 2. Retrieve top 5 chunks from DB
    const { data: matches, error } = await supabase.rpc('match_chatbot_chunks', {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    })
    if (error) throw error

    // 3. Build context string
    const context = (matches || []).map((m: any) => m.content).join('\n\n')

    // 4. Build conversation history for OpenAI
    const history = [
      {
        role: 'system',
        content:
          'You are a helpful assistant. Use the provided context when relevant. ' +
          "If the answer is not in the context, reply: 'I don’t know based on the documents.'",
      },
      {
        role: 'system',
        content: `Context:\n${context}`,
      },
      ...messages, // preserve full user/assistant history
    ]

    // 5. Call OpenAI with full history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-3.5-turbo
      messages: history,
    })

    const answer =
      completion.choices[0].message?.content || 'No answer generated.'

    return NextResponse.json({ answer, context })
  } catch (err: any) {
    console.error('Chat error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
