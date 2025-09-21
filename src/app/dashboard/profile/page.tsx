'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'

export default function ProfilePage() {
  const [session, setSession] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session)
        setEmail(data.session.user.email ?? "")
        setCreatedAt(data.session.user.created_at)
        const userId = data.session.user.id

        // Fetch profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (profile) {
          setFirstName(profile.first_name || '')
          setLastName(profile.last_name || '')
        } else {
          await supabase.from('profiles').insert({ id: userId })
        }
      }
    })
  }, [])

  const handleSave = async () => {
    if (!session) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        first_name: firstName,
        last_name: lastName,
      })

    setLoading(false)
    if (!error) alert('Profile saved!')
  }

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="p-8 space-y-6">
          <h2 className="text-xl font-bold">My Profile</h2>
          <div className="bg-white shadow p-4 rounded space-y-3">
            <p><b>Email:</b> {email}</p>
            <p><b>Joined:</b> {new Date(createdAt).toLocaleString()}</p>

            <label className="block text-sm font-medium mt-4">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />

            <label className="block text-sm font-medium">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.href = '/'
                }}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Log Out
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
