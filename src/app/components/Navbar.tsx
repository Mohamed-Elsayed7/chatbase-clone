'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Navbar() {
  const [display, setDisplay] = useState<string>('Hello')

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, is_superadmin')
        .eq('id', uid)
        .maybeSingle()

      if (profile?.is_superadmin) {
        setDisplay(`Hello, ${profile.first_name ?? 'there'} — Super Admin`)
        return
      }

      // grab first org membership (display one)
      const { data: mems } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(name)')
        .eq('user_id', uid)

      const orgName = (mems?.[0] as any)?.organizations?.name
      setDisplay(orgName
        ? `Hello, ${profile?.first_name ?? 'there'} — ${orgName}`
        : `Hello, ${profile?.first_name ?? 'there'}`
      )
    }
    load()
  }, [])

  return (
    <header className="w-full bg-gray-200 p-4 flex justify-between">
      <h1 className="font-bold">Dashboard</h1>
      <div className="text-sm text-gray-700">{display}</div>
    </header>
  )
}
