import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="w-60 h-screen bg-gray-100 border-r p-6">
      <nav className="flex flex-col gap-4">
        <Link href="/dashboard" className="hover:text-blue-600 font-medium">
          Dashboard
        </Link>
        <Link href="/settings" className="hover:text-blue-600 font-medium">
          Settings
        </Link>
        <Link href="/help" className="hover:text-blue-600 font-medium">
          Help
        </Link>
        <Link href="/dashboard/profile" className="hover:text-blue-600 font-medium">
          Profile
        </Link>
      </nav>
    </aside>
  )
}
