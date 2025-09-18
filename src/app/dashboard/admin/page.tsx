'use client'

import { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type AdminUser = {
  id: string
  first_name: string | null
  last_name: string | null
  plan: string
  created_at: string
  is_admin: boolean
  chatbot_count: number
  tokens_this_month: number
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminUser[]>([])
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

      // check profile.is_admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        setError('Forbidden: not an admin')
        setLoading(false)
        return
      }

      setIsAdmin(true)

      // fetch overview data (no auth header needed)
      try {
        const res = await fetch('/api/admin/overview')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load admin data')
        setData(json)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-6">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-600">Error: {error}</p>}

          {isAdmin && !loading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-4 py-2 text-left">User</th>
                    <th className="border px-4 py-2">Plan</th>
                    <th className="border px-4 py-2">Chatbots</th>
                    <th className="border px-4 py-2">Tokens (this month)</th>
                    <th className="border px-4 py-2">Created</th>
                    <th className="border px-4 py-2">Admin</th>
                    <th className="border px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="border px-4 py-2">
                        {u.first_name} {u.last_name || ''} <br />
                        <span className="text-xs text-gray-500">{u.id}</span>
                      </td>
                      <td className="border px-4 py-2 text-center">{u.plan}</td>
                      <td className="border px-4 py-2 text-center">
                        {u.chatbot_count}
                      </td>
                      <td className="border px-4 py-2 text-center">
                        {u.tokens_this_month.toLocaleString()}
                      </td>
                      <td className="border px-4 py-2 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="border px-4 py-2 text-center">
                        {u.is_admin ? '✅' : ''}
                      </td>
                      <td className="border px-4 py-2 text-center">
                        <Link
                          href={`/dashboard/admin/${u.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
