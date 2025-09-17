'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Navbar() {
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const userId = session.user.id

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', userId)
          .single()

        if (profile?.first_name) {
          setDisplayName(profile.first_name)
        } else {
          setDisplayName(session.user.email ?? null) // fallback
        }
      }
    }
    loadProfile()
  }, [])

  return (
    <header className="w-full bg-gray-200 p-4 flex justify-between">
      <h1 className="font-bold">Dashboard</h1>
      <div className="text-sm text-gray-700">
        {displayName ? `Hello, ${displayName}` : 'Hello'}
      </div>
    </header>
  )
}
