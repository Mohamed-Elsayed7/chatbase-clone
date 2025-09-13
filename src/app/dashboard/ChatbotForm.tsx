'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ChatbotForm({ onAdd }: { onAdd: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from('chatbots').insert([{ name, description }])

    if (error) setError(error.message)
    else {
      setName('')
      setDescription('')
      onAdd() // refresh list
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow p-6 rounded-md mb-6">
      <h2 className="text-lg font-semibold mb-4">Add Chatbot</h2>
      {error && <p className="text-red-600 mb-2">{error}</p>}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Chatbot Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>
      <div className="mb-3">
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        {loading ? 'Saving...' : 'Save Chatbot'}
      </button>
    </form>
  )
}
