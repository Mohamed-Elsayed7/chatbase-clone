'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function WidgetPage() {
  const searchParams = useSearchParams()
  const chatbotId = searchParams.get('chatbotId')
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const newMsg = { role: 'user', content: input }
    setMessages([...messages, newMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: Number(chatbotId), messages: [...messages, newMsg] }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + e.message }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-white">
      <div className="flex-none bg-blue-600 text-white p-3 font-semibold rounded-t-lg">
        Chatbot
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded max-w-[80%] ${
              m.role === 'user'
                ? 'ml-auto bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800'
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-none border-t p-2 flex">
        <input
          className="flex-1 border px-2 py-1 rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="ml-2 px-3 py-1 bg-blue-600 text-white rounded"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
