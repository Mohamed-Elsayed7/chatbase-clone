'use client'

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setEmail(data.user.email)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // redirect to login page
  }

  return (
    <nav className="w-full bg-white shadow px-6 py-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">🚀 Chatbase Clone</h1>
      <div className="flex items-center gap-4">
        {email && <span className="text-gray-700">{email}</span>}
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
