'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function SettingsPanel({ chatbot, chatbotId, onUpdate }: any) {
  const [editName, setEditName] = useState(chatbot.name)
  const [editDescription, setEditDescription] = useState(chatbot.description || '')
  const [editWebsite, setEditWebsite] = useState(chatbot.website_url || '')
  const [systemPrompt, setSystemPrompt] = useState(chatbot.system_prompt || 'You are a helpful assistant.')
  const [tone, setTone] = useState(chatbot.tone || 'neutral')
  const [copied, setCopied] = useState(false)

  const handleUpdate = async () => {
    const { error } = await supabase
      .from('chatbots')
      .update({
        name: editName,
        description: editDescription,
        website_url: editWebsite,
        system_prompt: systemPrompt,
        tone,
      })
      .eq('id', chatbotId)

    if (!error) {
      onUpdate({
        ...chatbot,
        name: editName,
        description: editDescription,
        website_url: editWebsite,
        system_prompt: systemPrompt,
        tone,
      })
      alert('Saved!')
    }
  }

  return (
    <div className="bg-white shadow p-4 rounded space-y-3">
      <h2 className="text-lg font-bold mb-2">Chatbot Settings</h2>
      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Bot name" />
      <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Description" />
      <input type="url" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="Website URL (optional)" />
      <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="w-full border px-3 py-2 rounded" placeholder="System prompt (default behavior)" />
      <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full border px-3 py-2 rounded">
        <option value="neutral">Neutral</option>
        <option value="friendly">Friendly</option>
        <option value="formal">Formal</option>
        <option value="professional">Professional</option>
        <option value="casual">Casual</option>
      </select>
      <div className="space-x-2">
        <button onClick={handleUpdate} className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
        <button
          onClick={async () => {
            const confirmed = window.confirm(`Delete "${chatbot.name}"? This cannot be undone.`)
            if (!confirmed) return
            const { error } = await supabase.from('chatbots').delete().eq('id', chatbotId)
            if (!error) window.location.href = '/dashboard'
          }}
          className="bg-red-600 text-white px-3 py-1 rounded"
        >
          Delete
        </button>
      </div>

      {/* Embed snippet */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2">Embed Code</h3>
        <p className="text-xs text-gray-600 mb-2">Copy and paste this code into your website&apos;s HTML to add the chatbot widget.</p>
        <div className="relative">
          <pre className="bg-gray-800 text-white text-xs p-3 rounded overflow-x-auto pr-12">
            {`<script src="${process.env.NEXT_PUBLIC_APP_URL}/embed.js" data-chatbot-id="${chatbotId}" data-chatbot-name="${editName || chatbot.name}"></script>`}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `<script src="${process.env.NEXT_PUBLIC_APP_URL}/embed.js" data-chatbot-id="${chatbotId}" data-chatbot-name="${editName || chatbot.name}"></script>`
              )
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded"
          >
            {copied ? '✅ Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
