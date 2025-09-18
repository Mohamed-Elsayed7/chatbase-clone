'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (profile?.is_admin) setIsAdmin(true)
    }
    fetchProfile()
  }, [])

  return (
    <aside className="w-60 h-screen bg-gray-100 border-r p-6">
      <nav className="flex flex-col gap-4">
        <Link href="/dashboard" className="hover:text-blue-600 font-medium">
          Dashboard
        </Link>
        <Link href="/settings" className="hover:text-blue-600 font-medium">
          Settings
        </Link>
        <Link href="/help" className="hover:text-blue-600 font-medium">
          Help
        </Link>
        <Link href="/dashboard/profile" className="hover:text-blue-600 font-medium">
          Profile
        </Link>

        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className="hover:text-blue-600 font-medium text-red-600"
          >
            🛠️ Admin
          </Link>
        )}
      </nav>
    </aside>
  )
}
