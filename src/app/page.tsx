'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [session, setSession] = useState<any>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let mounted = true

    // 1) get current session once
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setBooting(false)
    })

    // 2) subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        Loading…
      </div>
    )
  }

  // Logged in view
  if (session) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <h1 className="text-2xl font-semibold">Welcome {session.user?.email}</h1>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="bg-black text-white px-4 py-2 rounded-md"
          >
            Go to Dashboard
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="bg-red-600 text-white px-4 py-2 rounded-md"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  // Logged out view (Auth UI)
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <h1 className="text-xl font-semibold mb-4 text-center">Login / Sign up</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="light"
          providers={['google']}
        />
      </div>
    </div>
  )
}
