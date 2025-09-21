'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function BillingPage() {
  const [session, setSession] = useState<any>(null)
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session)
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', data.session.user.id)
          .maybeSingle()
        if (profile?.plan) setPlan(profile.plan)
      }
    })
  }, [])

  const startCheckout = async (priceId: string) => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, priceId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const openPortal = async () => {
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  if (!session) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Billing</h2>
      <p className="mb-4">Current plan: <b>{plan}</b></p>

      <div className="space-y-3">
        <button
          onClick={() => startCheckout('price_pro_id')}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Upgrade to Pro
        </button>
        <button
          onClick={() => startCheckout('price_enterprise_id')}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Upgrade to Enterprise
        </button>
        <button
          onClick={openPortal}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Manage Subscription
        </button>
      </div>
    </div>
  )
}
