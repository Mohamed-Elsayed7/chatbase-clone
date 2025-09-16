import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(req: Request) {
  try {
    const { chatbotId, messages } = await req.json()

    if (!chatbotId || !messages) {
      return NextResponse.json({ error: 'Missing chatbotId or messages[]' }, { status: 400 })
    }

    // Get chatbot settings
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('system_prompt, tone')
      .eq('id', chatbotId)
      .single()

    if (chatbotError || !chatbot) throw new Error('Chatbot not found')

    const userMsg = messages[messages.length - 1]?.content || ''

    // Create embedding for last user question
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: userMsg,
    })
    const queryEmbedding = emb.data[0].embedding

    // Retrieve chunks
    const { data: matches, error } = await supabase.rpc('match_chatbot_chunks', {
      p_chatbot_id: chatbotId,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    })
    if (error) throw error

    const context = (matches || []).map((m: any) => m.content).join('\n\n')

    // Build system prompt with custom fields
    const systemPrompt = chatbot.system_prompt || 'You are a helpful assistant.'
    const tone = chatbot.tone || 'neutral'

    const history = [
      {
        role: 'system',
        content: `${systemPrompt}\nTone: ${tone}.\nUse the provided context when relevant. If the answer is not in the context, reply: "I don’t know based on the documents."`,
      },
      {
        role: 'system',
        content: `Context:\n${context}`,
      },
      ...messages,
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history,
    })

    const answer = completion.choices[0].message?.content || 'No answer generated.'

    return NextResponse.json({ answer, context })
  } catch (err: any) {
    console.error('Chat error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
