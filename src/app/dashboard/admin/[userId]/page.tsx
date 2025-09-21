'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '../../../components/Navbar'
import Sidebar from '../../../components/Sidebar'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'

type UserDetail = {
  id: string
  first_name: string | null
  last_name: string | null
  plan: string
  created_at: string
  is_superadmin: boolean
}

type Chatbot = {
  id: number
  name: string
  created_at: string
}

type UsagePoint = {
  date: string
  tokens: number
  chats: number
}

export default function AdminUserDetail() {
  const { userId } = useParams()
  const [user, setUser] = useState<UserDetail | null>(null)
  const [bots, setBots] = useState<Chatbot[]>([])
  const [usage, setUsage] = useState<UsagePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const run = async () => {
      // check current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Not logged in')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.is_superadmin) {
        setError('Forbidden: not an admin')
        setLoading(false)
        return
      }

      setIsAdmin(true)

      // fetch drilldown data
      try {
        const res = await fetch(`/api/admin/user/${userId}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load user detail')
        setUser(json.user)
        setBots(json.bots)
        setUsage(json.usageOverTime)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [userId])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">User Detail</h1>
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Admin
            </Link>
          </div>

          {loading && <p>Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}

          {isAdmin && !loading && !error && user && (
            <div className="space-y-6">
              {/* Profile */}
              <div className="p-4 border rounded">
                <h2 className="font-semibold mb-2">Profile</h2>
                <p><strong>ID:</strong> {user.id}</p>
                <p><strong>Name:</strong> {user.first_name} {user.last_name}</p>
                <p><strong>Plan:</strong> {user.plan}</p>
                <p><strong>Created:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                <p><strong>Admin:</strong> {user.is_superadmin ? '✅' : '—'}</p>
              </div>

              {/* Chatbots */}
              <div className="p-4 border rounded">
                <h2 className="font-semibold mb-2">Chatbots</h2>
                {bots.length > 0 ? (
                  <ul className="space-y-2">
                    {bots.map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/dashboard/${b.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {b.name}
                        </Link>{' '}
                        <span className="text-xs text-gray-500">
                          ({new Date(b.created_at).toLocaleDateString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No chatbots yet</p>
                )}
              </div>

              {/* Usage */}
              <div className="p-4 border rounded">
                <h2 className="font-semibold mb-2">Usage Over Time</h2>
                {usage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={usage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="tokens" stroke="#2563eb" name="Tokens" />
                      <Line type="monotone" dataKey="chats" stroke="#16a34a" name="Chats" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500">No usage logs</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
