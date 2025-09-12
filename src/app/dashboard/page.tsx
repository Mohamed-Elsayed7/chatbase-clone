'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) router.replace('/')
      setSession(data.session)
    }
    fetchSession()
  }, [router])

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-gray-600">This is a protected page. You are logged in as <b>{session.user.email}</b>.</p>
    </div>
  )
}