'use client'

import { useEffect, useState } from 'react'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import Link from 'next/link'

type AdminUser = {
  id: string
  first_name: string | null
  last_name: string | null
  plan: string
  created_at: string
  is_superadmin: boolean
  chatbot_count: number
  tokens_this_month: number
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const res = await fetch('/api/admin/overview', { cache: 'no-store' })
      const data = await res.json()
      setUsers(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8 space-y-6">
          <h1 className="text-2xl font-bold">Superadmin Overview</h1>

          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Bots</th>
                    <th className="py-2 pr-4">Tokens (month)</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 pr-4">{u.first_name ?? '(no name)'} {u.last_name ?? ''}</td>
                      <td className="py-2 pr-4">{u.plan}</td>
                      <td className="py-2 pr-4">{u.chatbot_count}</td>
                      <td className="py-2 pr-4">{u.tokens_this_month}</td>
                      <td className="py-2 pr-4">{u.is_superadmin ? 'Super Admin' : 'User'}</td>
                      <td className="py-2 pr-4">
                        <Link
                          href={`/dashboard/admin/${u.id}`}
                          className="px-3 py-1 rounded bg-blue-600 text-white"
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
