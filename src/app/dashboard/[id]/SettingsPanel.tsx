'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsPanel({ chatbot, chatbotId, onUpdate }: any) {
  const [editName, setEditName] = useState(chatbot.name)
  const [editDescription, setEditDescription] = useState(chatbot.description || '')
  const [editWebsite, setEditWebsite] = useState(chatbot.website_url || '')
  const [systemPrompt, setSystemPrompt] = useState(chatbot.system_prompt || 'You are a helpful assistant.')
  const [tone, setTone] = useState(chatbot.tone || 'neutral')

  // Widget settings
  const [brandName, setBrandName] = useState(chatbot.brand_name || '')
  const [theme, setTheme] = useState<'light' | 'dark'>(chatbot.widget_theme === 'dark' ? 'dark' : 'light')
  const [primary, setPrimary] = useState(chatbot.widget_primary_color || '#2563eb')
  const [logoUrl, setLogoUrl] = useState(chatbot.widget_logo_url || '')
  const [greeting, setGreeting] = useState(chatbot.widget_greeting || '👋 Hi! How can I help you?')
  const [position, setPosition] = useState<'left' | 'right'>(chatbot.widget_position === 'left' ? 'left' : 'right')
  const [openByDefault, setOpenByDefault] = useState<boolean>(!!chatbot.widget_open_by_default)

  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const widgetScriptSrc = `${process.env.NEXT_PUBLIC_APP_URL}/embed.js`

  const handleUpdate = async () => {
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('chatbots')
      .update({
        name: editName,
        description: editDescription,
        website_url: editWebsite,
        system_prompt: systemPrompt,
        tone,
        // widget fields
        brand_name: brandName || null,
        widget_theme: theme,
        widget_primary_color: primary || '#2563eb',
        widget_logo_url: logoUrl || null,
        widget_greeting: greeting || '👋 Hi! How can I help you?',
        widget_position: position,
        widget_open_by_default: openByDefault,
      })
      .eq('id', chatbotId)

    setSaving(false)
    if (error) {
      setError(error.message)
    } else {
      // ✅ stay on the same page, don’t reload
      // optionally show a toast/snackbar instead
    }
  }

  const embedCode = `<script src="${widgetScriptSrc}" data-chatbot-id="${chatbotId}" data-chatbot-name="${editName}"></script>`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* General settings */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">General</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Website URL</label>
          <input value={editWebsite} onChange={e => setEditWebsite(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">System Prompt</label>
          <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="w-full border rounded px-3 py-2" rows={4} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tone</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="neutral">neutral</option>
            <option value="friendly">friendly</option>
            <option value="professional">professional</option>
            <option value="playful">playful</option>
          </select>
        </div>
      </div>

      {/* Widget settings */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Widget</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Brand Name</label>
          <input value={brandName} onChange={e => setBrandName(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Acme Support" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select value={theme} onChange={e => setTheme(e.target.value as any)} className="w-full border rounded px-3 py-2">
              <option value="light">light</option>
              <option value="dark">dark</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Primary Color</label>
            <input value={primary} onChange={e => setPrimary(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="#2563eb" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="https://…" />
          <p className="text-xs text-gray-500 mt-1">Tip: host on a public bucket or your CDN.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Greeting</label>
          <input value={greeting} onChange={e => setGreeting(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Position</label>
            <select value={position} onChange={e => setPosition(e.target.value as any)} className="w-full border rounded px-3 py-2">
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 mt-6">
            <input id="openByDefault" type="checkbox" checked={openByDefault} onChange={e => setOpenByDefault(e.target.checked)} />
            <label htmlFor="openByDefault" className="text-sm">Open by default</label>
          </div>
        </div>

        <div className="pt-2">
          <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error && <span className="ml-3 text-red-600 text-sm">⚠️ {error}</span>}
        </div>

        <div className="pt-6">
          <h3 className="font-semibold mb-2">Embed Code</h3>
          <pre className="text-xs bg-gray-100 p-3 rounded border overflow-x-auto">{embedCode}</pre>
          <button onClick={handleCopy} className="mt-2 px-3 py-1 bg-gray-800 text-white text-sm rounded">
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <p className="text-xs text-gray-500 mt-3">
            Advanced: You can override widget visuals via script attributes:
            <code className="ml-1">data-brand-name</code>,
            <code className="ml-1">data-theme</code>,
            <code className="ml-1">data-primary-color</code>,
            <code className="ml-1">data-logo-url</code>,
            <code className="ml-1">data-position</code>,
            <code className="ml-1">data-open-by-default</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
