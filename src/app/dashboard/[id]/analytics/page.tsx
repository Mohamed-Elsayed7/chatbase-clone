'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '../../../components/Navbar'
import Sidebar from '../../../components/Sidebar'

// Charts
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend
} from 'recharts'

type UsagePoint = { date: string; tokens: number; chats: number }

type Analytics = {
  totalChats: number
  totalTokens: number
  totalFiles: number
  totalEmbeddings: number
  usageOverTime: UsagePoint[]
}

export default function AnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const chatbotId = Number(params?.id as string)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chatbotId || Number.isNaN(chatbotId)) return
    const run = async () => {
      try {
        const res = await fetch(`/api/analytics/${chatbotId}`, { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load analytics')
        setData(json)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [chatbotId])

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex">
        <Sidebar />

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Analytics</h1>
            <Link href={`/dashboard/${chatbotId}`} className="text-blue-600 hover:underline">
              ← Back to Bot
            </Link>
          </div>

          {loading && <p>Loading analytics…</p>}
          {error && <p className="text-red-600">Error: {error}</p>}

          {data && (
            <div className="space-y-8">
              {/* Stat cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Chats" value={data.totalChats} />
                <StatCard label="Tokens Used" value={data.totalTokens.toLocaleString()} />
                <StatCard label="Files Uploaded" value={data.totalFiles} />
                <StatCard label="Embeddings" value={data.totalEmbeddings} />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-4">Tokens Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.usageOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="tokens" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-4">Chats Over Time</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.usageOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="chats" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 border rounded-lg">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
