import './globals.css'
// import type { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Chatbase Clone Starter',
  description: 'Next.js + Tailwind + Supabase Auth UI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

