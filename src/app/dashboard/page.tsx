'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import ChatbotForm from './ChatbotForm'
import { supabase } from '@/lib/supabaseClient'

type ChatbotRow = {
  id: number
  name: string
  description: string | null
  user_id: string
  organization_id: number | null
  organization_name: string | null
  created_at: string
  brand_name: string | null
  widget_theme: string | null
  widget_primary_color: string | null
  website_url: string | null
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [chatbots, setChatbots] = useState<ChatbotRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/')
        return
      }
      setSession(data.session)
      await fetchChatbots()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchChatbots = async () => {
    setLoading(true)
    try {
      // 🔐 Get Supabase access token for Bearer auth
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await fetch('/api/chatbots', {
        cache: 'no-store',
        credentials: 'include',
        headers,
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const json = await res.json()
      setChatbots(json.chatbots || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Your Chatbots</h1>
            <p className="text-sm text-gray-600">
              You’ll see bots you own and those from your organization.
            </p>
          </div>

          <ChatbotForm onAdd={fetchChatbots} />

          {loading ? (
            <div className="text-sm text-gray-500">Loading chatbots…</div>
          ) : chatbots.length === 0 ? (
            <div className="text-sm text-gray-500">No chatbots yet.</div>
          ) : (
            <ul className="divide-y">
              {chatbots.map((bot) => (
                <li key={bot.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{bot.name}</div>
                    <div className="text-xs text-gray-500">
                      {bot.organization_name ? `Organization: ${bot.organization_name}` : 'Personal bot'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/${bot.id}`)}
                      className="bg-blue-600 text-white px-3 py-1 rounded"
                    >
                      Edit
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}
