'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', user.id)
        .maybeSingle()
      setIsAdmin(!!profile?.is_superadmin)
    }
    fetchProfile()
  }, [])

  return (
    <aside className="w-64 border-r p-4">
      <nav className="space-y-2">
        <Link href="/dashboard" className="hover:text-blue-600 font-medium">
          🧩 Chatbots
        </Link>
        <Link href="/dashboard/profile" className="hover:text-blue-600 font-medium">
          👤 Profile
        </Link>
        <Link href="/dashboard/billing" className="hover:text-blue-600 font-medium">
          💳 Billing
        </Link>
        {isAdmin && (
          <Link href="/dashboard/admin" className="hover:text-blue-600 font-medium text-red-600">
            🛠️ Admin
          </Link>
        )}
      </nav>
    </aside>
  )
}
