'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

export default function ChatPanel({ chatbotId }: { chatbotId: number }) {
  const [messages, setMessages] = useState<{ role: string; content: string; time: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const newMsg = { role: 'user', content: input, time: now }
    const newMessages = [...messages, newMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // 1️⃣ Query embeddings
      const queryRes = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          chatbotId,
          query: input,
        }),
      })
      if (!queryRes.ok) throw new Error(`Query failed (${queryRes.status})`)
      const queryData = await queryRes.json()

      const context = (queryData.matches || [])
        .map((m: any) => m.content)
        .join('\n\n')

      // 2️⃣ Call chat API
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          chatbotId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          retrievedContext: context,
        }),
      })

      if (!res.ok) throw new Error(`Chat failed (${res.status})`)
      const data = await res.json()

      const botMsg = {
        role: 'assistant',
        content: data.answer || 'No answer returned.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, botMsg])
    } catch (e: any) {
      toast.error(`⚠️ ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 w-full max-w-xl bg-white shadow">
      <div className="h-72 overflow-y-auto mb-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[70%] px-3 py-2 rounded-lg text-sm shadow ${
                m.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              <p>{m.content}</p>
              <span className="block text-xs text-gray-400 mt-1 text-right">{m.time}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex">
        <input
          className="flex-1 border px-3 py-2 rounded-l-lg focus:outline-none"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask a question..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
