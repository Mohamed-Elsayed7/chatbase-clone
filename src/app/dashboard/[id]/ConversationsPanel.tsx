'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

export default function ConversationsPanel({ chatbotId }: { chatbotId: number }) {
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConv, setSelectedConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchConversations = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/chatbots/${chatbotId}/conversations`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await res.json()
      if (res.ok) {
        setConversations(data.conversations || [])
      } else {
        console.error('Failed to load conversations:', data.error)
      }
    }
    fetchConversations()
  }, [chatbotId])

  const loadMessages = async (convId: string) => {
    setLoading(true)
    setSelectedConv(convId)
    setMessages([])

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch(`/api/conversations/${convId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    const data = await res.json()
    if (res.ok) {
      setMessages(data.messages || [])
    } else {
      console.error('Failed to load messages:', data.error)
    }
    setLoading(false)
  }

  const deleteConversation = async (convId: string) => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/conversations/${convId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("🗑️ Conversation deleted")
        setConversations((prev) => prev.filter((c) => c.id !== convId))
        if (selectedConv === convId) {
          setSelectedConv(null)
          setMessages([])
        }
      } else {
        toast.error(`⚠️ ${data.error || "Delete failed"}`)
      }
    } catch (err: any) {
      toast.error(`⚠️ ${err.message}`)
    }
  }

  const renameConversation = async (convId: string) => {
    const newTitle = prompt("Enter new conversation title:")
    if (!newTitle || !newTitle.trim()) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/conversations/${convId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ title: newTitle }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("✅ Conversation renamed")
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, title: newTitle } : c
          )
        )
      } else {
        toast.error(`⚠️ ${data.error || "Rename failed"}`)
      }
    } catch (err: any) {
      toast.error(`⚠️ ${err.message}`)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 h-full gap-6">
      {/* Conversation list */}
      <div className="border rounded p-3 overflow-y-auto">
        <h2 className="font-bold mb-3">Conversations</h2>
        <ul className="space-y-2">
          {conversations.map((conv) => (
            <li
              key={conv.id}
              className={`p-2 rounded border ${
                selectedConv === conv.id ? 'bg-blue-50 border-blue-400' : 'hover:bg-gray-50'
              }`}
            >
              <div
                className="cursor-pointer"
                onClick={() => loadMessages(conv.id)}
              >
                <div className="text-sm font-medium">
                  {conv.title || `Visitor ${conv.id.slice(0, 8)}…`}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(conv.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => renameConversation(conv.id)}
                  className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                >
                  Rename
                </button>
                <button
                  onClick={() => deleteConversation(conv.id)}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Messages viewer */}
      <div className="lg:col-span-2 border rounded flex flex-col">
        <div className="flex-none border-b p-2 font-bold">
          {selectedConv ? `Conversation ${selectedConv.slice(0, 8)}…` : 'Select a conversation'}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm bg-gray-50">
          {loading && <div>Loading messages…</div>}
          {!loading && messages.map((m, i) => (
            <div
              key={i}
              className={`p-2 rounded max-w-[80%] ${
                m.role === 'user'
                  ? 'ml-auto bg-blue-500 text-white'
                  : 'bg-white border text-gray-800'
              }`}
            >
              {m.content}
              <div className="text-[10px] opacity-60 mt-1">
                {new Date(m.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
