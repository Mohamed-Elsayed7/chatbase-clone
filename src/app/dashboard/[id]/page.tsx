'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import SettingsPanel from './SettingsPanel'
import FilesPanel from './FilesPanel'
import ChatPanelWrapper from './ChatPanelWrapper'
import AnalyticsPanel from './AnalyticsPanel'
import { supabase } from '@/lib/supabaseClient'

export default function ChatbotDetail() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const chatbotId = Number(params.id)
  const [chatbot, setChatbot] = useState<any>(null)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'chat')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchChatbot = async () => {
      setLoading(true)
      setError(null)
      try {
        // 🔐 Pull token for Bearer auth
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/')
          return
        }
        const token = data.session.access_token
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

        const res = await fetch(`/api/chatbots/${chatbotId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load chatbot')
        setChatbot(json)
      } catch (e: any) {
        console.error('Failed to fetch chatbot', e)
        setError(e.message)
        setChatbot(null)
      } finally {
        setLoading(false)
      }
    }
    if (Number.isFinite(chatbotId)) {
      fetchChatbot()
    } else {
      setError('Invalid chatbot id')
      setLoading(false)
    }
  }, [chatbotId, router])

  useEffect(() => {
    const tab = searchParams.get('tab') || 'chat'
    setActiveTab(tab)
  }, [searchParams])

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="p-8">Loading chatbot...</main>
        </div>
      </div>
    )
  }

  if (error || !chatbot) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="p-8 text-red-600">
            {error || 'Chatbot not found'}
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8 space-y-6">
          {/* Tabs */}
          <div className="flex justify-between items-center border-b mb-4">
            <div className="flex space-x-2">
              <TabButton
                router={router}
                chatbotId={chatbotId}
                tab="settings"
                active={activeTab === 'settings'}
                label="Settings"
                icon="⚙️"
              />
              <TabButton
                router={router}
                chatbotId={chatbotId}
                tab="files"
                active={activeTab === 'files'}
                label="Files"
                icon="📁"
              />
              <TabButton
                router={router}
                chatbotId={chatbotId}
                tab="chat"
                active={activeTab === 'chat'}
                label="Chat"
                icon="💬"
              />
              <TabButton
                router={router}
                chatbotId={chatbotId}
                tab="analytics"
                active={activeTab === 'analytics'}
                label="Analytics"
                icon="📊"
              />
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'settings' && (
            <SettingsPanel
              chatbot={chatbot}
              chatbotId={chatbotId}
              onUpdate={setChatbot}
            />
          )}
          {activeTab === 'files' && (
            <FilesPanel chatbot={chatbot} chatbotId={chatbotId} />
          )}
          {activeTab === 'chat' && (
            <ChatPanelWrapper chatbot={chatbot} chatbotId={chatbotId} />
          )}
          {activeTab === 'analytics' && <AnalyticsPanel chatbotId={chatbotId} />}
        </main>
      </div>
    </div>
  )
}

function TabButton({ router, chatbotId, tab, active, label, icon }: any) {
  return (
    <button
      onClick={() => router.push(`/dashboard/${chatbotId}?tab=${tab}`)}
      className={`px-4 py-2 rounded-t flex items-center space-x-2 ${
        active
          ? 'bg-blue-600 text-white font-semibold'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
