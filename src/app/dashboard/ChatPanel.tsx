'use client'

import { useState } from 'react'

export default function ChatPanel({ chatbotId }: { chatbotId: number }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

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
        body: JSON.stringify({ chatbotId, question: newMsg.content }),
      })

      const data = await res.json()
      if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Error: no answer.' }])
      }
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: ' + e.message },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded p-4 w-full max-w-lg">
      <div className="h-64 overflow-y-auto mb-3 border p-2 bg-gray-50">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'text-blue-600' : 'text-green-600'}
          >
            <b>{m.role === 'user' ? 'You' : 'Bot'}:</b> {m.content}
          </div>
        ))}
      </div>
      <div className="flex">
        <input
          className="flex-1 border px-2 py-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="ml-2 px-3 py-1 bg-blue-500 text-white rounded"
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
