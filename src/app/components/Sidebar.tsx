'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePathname } from 'next/navigation'

// Lucide icons
import { Bot, User, CreditCard, Shield } from 'lucide-react'

export default function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()

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

  const navItems = [
    { href: '/dashboard', label: 'Chatbots', icon: Bot },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  ]

  return (
    <aside className="w-60 h-screen bg-gray-100 border-r p-6">
      <nav className="flex flex-col gap-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 font-semibold'
                  : 'text-gray-700 hover:text-blue-600'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className={`flex items-center gap-2 font-medium transition-colors ${
              pathname.startsWith('/dashboard/admin')
                ? 'text-red-600 font-semibold'
                : 'text-red-500 hover:text-red-600'
            }`}
          >
            <Shield size={18} />
            Admin
          </Link>
        )}
      </nav>
    </aside>
  )
}
