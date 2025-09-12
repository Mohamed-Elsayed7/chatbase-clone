'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/')
      else setSession(data.session)
    })
  }, [router])

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8">
          <h1 className="text-2xl font-bold mb-4">Welcome to your Dashboard</h1>
          <p className="text-gray-600">
            This is a protected area. Only logged-in users can see this.
          </p>
        </main>
      </div>
    </div>
  )
}
