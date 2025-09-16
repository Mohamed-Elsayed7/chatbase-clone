// src/app/dashboard/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import ChatbotFiles from '../ChatbotFiles'
import ChatPanel from '../ChatPanel'

export default function ChatbotDetail() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [copied, setCopied] = useState(false)
  const chatbotId = Number(params.id)
  const [chatbot, setChatbot] = useState<any>(null)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'chat')

  // Edit form states
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [tone, setTone] = useState('neutral')

  // Fetch chatbot info
  useEffect(() => {
    const fetchChatbot = async () => {
      const { data, error } = await supabase
        .from('chatbots')
        .select('*')
        .eq('id', chatbotId)
        .single()

      if (!error && data) {
        setChatbot(data)
        setEditName(data.name)
        setEditDescription(data.description || '')
        setEditWebsite(data.website_url || '')
        setSystemPrompt(data.system_prompt || 'You are a helpful assistant.')
        setTone(data.tone || 'neutral')
      }
    }

    fetchChatbot()
  }, [chatbotId])

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab') || 'chat'
    setActiveTab(tab)
  }, [searchParams])

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('chatbots')
      .update({
        name: editName,
        description: editDescription,
        website_url: editWebsite,
        system_prompt: systemPrompt,
        tone,
      })
      .eq('id', chatbotId)

    if (!error) {
      setChatbot({
        ...chatbot,
        name: editName,
        description: editDescription,
        website_url: editWebsite,
        system_prompt: systemPrompt,
        tone,
      })
      alert('Saved!')
    }
  }

  if (!chatbot) return <div className="p-8">Loading chatbot...</div>

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8 space-y-6">
          {/* Tabs with Back button */}
          <div className="flex justify-between items-center border-b mb-4">
            <div className="flex space-x-2">
              <button
                onClick={() => router.push(`/dashboard/${chatbotId}?tab=settings`)}
                className={`px-4 py-2 rounded-t flex items-center space-x-2 ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>⚙️</span>
                <span>Settings</span>
              </button>
              <button
                onClick={() => router.push(`/dashboard/${chatbotId}?tab=files`)}
                className={`px-4 py-2 rounded-t flex items-center space-x-2 ${
                  activeTab === 'files'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>📁</span>
                <span>Files</span>
              </button>
              <button
                onClick={() => router.push(`/dashboard/${chatbotId}?tab=chat`)}
                className={`px-4 py-2 rounded-t flex items-center space-x-2 ${
                  activeTab === 'chat'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>💬</span>
                <span>Chat</span>
              </button>
            </div>

            {/* Back button aligned right */}
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'settings' && (
          <div className="bg-white shadow p-4 rounded space-y-3">
            <h2 className="text-lg font-bold mb-2">Chatbot Settings</h2>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Bot name"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Description"
            />
            <input
              type="url"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="Website URL (optional)"
            />
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              placeholder="System prompt (default behavior)"
            />
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="neutral">Neutral</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
            </select>
            <div className="space-x-2">
              <button
                onClick={handleUpdate}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Save
              </button>
              <button
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Delete "${chatbot.name}"? This cannot be undone.`
                  )
                  if (!confirmed) return
                  const { error } = await supabase
                    .from('chatbots')
                    .delete()
                    .eq('id', chatbotId)
                  if (!error) router.push('/dashboard')
                }}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>

            {/* Embed snippet */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Embed Code</h3>
              <p className="text-xs text-gray-600 mb-2">
                Copy and paste this code into your website&apos;s HTML to add the chatbot widget.
              </p>

              <div className="relative">
                <pre className="bg-gray-800 text-white text-xs p-3 rounded overflow-x-auto pr-12">
                  {`<script src="${process.env.NEXT_PUBLIC_APP_URL}/embed.js" data-chatbot-id="${chatbotId}" data-chatbot-name="${editName || chatbot.name}"></script>`}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `<script src="${process.env.NEXT_PUBLIC_APP_URL}/embed.js" data-chatbot-id="${chatbotId}" data-chatbot-name="${editName || chatbot.name}"></script>`
                    )
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000) // hide after 2s
                  }}
                  className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
                >
                  {copied ? '✅ Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}


          {activeTab === 'files' && (
            <div>
              <h2 className="text-lg font-bold mb-2">Manage Files</h2>
              <ChatbotFiles chatbotId={chatbotId} userId={chatbot.user_id} />
            </div>
          )}

          {activeTab === 'chat' && (
            <div>
              <h2 className="text-lg font-bold mb-2">Chat with {chatbot.name}</h2>
              <ChatPanel chatbotId={chatbotId} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
