'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import ChatbotForm from './ChatbotForm'

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [chatbots, setChatbots] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/')
      else {
        setSession(data.session)
        fetchChatbots(data.session.user.id)
      }
    })
  }, [router])

  const fetchChatbots = async (userId: string) => {
    const { data, error } = await supabase
      .from('chatbots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setChatbots(data)
  }

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8">
          <ChatbotForm onAdd={() => fetchChatbots(session.user.id)} />

          <h2 className="text-xl font-semibold mb-4">My Chatbots</h2>
          {chatbots.length === 0 ? (
            <p className="text-gray-500">No chatbots yet. Add one above!</p>
          ) : (
            <ul className="space-y-3">
              {chatbots.map((bot) => (
                <li
                  key={bot.id}
                  className="bg-white shadow p-4 rounded flex justify-between items-center"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/${bot.id}`)}
                  >
                    <h3 className="font-bold">{bot.name}</h3>
                    <p className="text-gray-600 text-sm">{bot.description}</p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const confirmed = window.confirm(
                          `Delete "${bot.name}"? This cannot be undone.`
                        )
                        if (!confirmed) return

                        const { error } = await supabase
                          .from('chatbots')
                          .delete()
                          .eq('id', bot.id)

                        if (!error && session) {
                          await fetchChatbots(session.user.id)
                        }
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/${bot.id}?tab=settings`)
                      }}
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
