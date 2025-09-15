'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import ChatbotForm from './ChatbotForm'
import ChatbotFiles from './ChatbotFiles'

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [chatbots, setChatbots] = useState<any[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
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

  const handleEdit = (bot: any) => {
    setEditingId(bot.id)
    setEditName(bot.name)
    setEditDescription(bot.description || '')
    setEditWebsite(bot.website_url || '')
  }

  const handleUpdate = async (id: number) => {
    const { error } = await supabase
      .from('chatbots')
      .update({ name: editName, description: editDescription, website_url: editWebsite })
      .eq('id', id)

    if (!error && session) {
      await fetchChatbots(session.user.id)
      setEditingId(null)
    }
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
                <li key={bot.id} className="bg-white shadow p-4 rounded">
                  {editingId === bot.id ? (
                    <div>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border px-3 py-2 rounded mb-2"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full border px-3 py-2 rounded mb-2"
                      />
                      <input
                        type="url"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        className="w-full border px-3 py-2 rounded mb-2"
                        placeholder="Website URL (optional)"
                      />
                      <button
                        onClick={() => handleUpdate(bot.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded mr-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-400 text-white px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold">{bot.name}</h3>
                      <p className="text-gray-600 mb-2">{bot.description}</p>
                      {bot.website_url ? (
                        <p className="text-blue-600 mb-2">
                          🌐 <a href={bot.website_url} target="_blank" rel="noopener noreferrer">{bot.website_url}</a>
                        </p>
                      ) : (
                        <p className="text-gray-400 mb-2">No website linked</p>
                      )}
                      <div className="text-sm text-gray-500 mb-2">
                        <p>Created: {new Date(bot.created_at).toLocaleString()}</p>
                        <p>Updated: {new Date(bot.updated_at).toLocaleString()}</p>
                      </div>
                      <ChatbotFiles chatbotId={bot.id} userId={session.user.id} />
                      <div className="mt-3">
                        <button
                          onClick={() => handleEdit(bot)}
                          className="bg-blue-600 text-white px-3 py-1 rounded mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm(`Delete "${bot.name}"? This cannot be undone.`);
                            if (!confirmed) return;

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
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </div>
  )
}
