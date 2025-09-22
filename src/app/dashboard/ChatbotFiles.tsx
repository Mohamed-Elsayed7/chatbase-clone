'use client'

import { useState, useEffect } from 'react'
import { processTxtFile, processPdfFile } from '@/lib/fileProcessor'
import { supabase } from '@/lib/supabaseClient'

export default function ChatbotFiles({ chatbotId, userId }: { chatbotId: number, userId: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<any[]>([])
  const [plan, setPlan] = useState<string>('free') // track plan

  useEffect(() => {
    fetchFiles()
    fetchPlan()
  }, [])

  const fetchPlan = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.plan) setPlan(profile.plan)
  }

  const fetchFiles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`/api/chatbot-files/${chatbotId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`Failed to fetch files (${res.status})`)
      const json = await res.json()
      setFiles(json.files || [])
    } catch (err: any) {
      console.error('Failed to fetch files:', err.message)
      setError(err.message)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()?.toLowerCase()

    setUploading(true)
    setError(null)

    const filePath = `${userId}/${chatbotId}/${file.name}`

    // 1. Upload file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('chatbot-files')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    // 2. Insert metadata into chatbot_files table
    const { data: fileData, error: dbError } = await supabase
      .from('chatbot_files')
      .insert([{ chatbot_id: chatbotId, file_path: filePath }])
      .select()
      .maybeSingle()

    if (dbError) {
      setError(dbError.message)
      setUploading(false)
      return
    }

    const fileId = fileData.id

    // 3. Process file → embeddings
    try {
      if (ext === 'txt') {
        await processTxtFile(chatbotId, file, fileId)
      } else if (ext === 'pdf') {
        await processPdfFile(chatbotId, file, fileId)
      } else {
        console.warn('Unsupported file type for embeddings:', ext)
      }
    } catch (err: any) {
      console.error('Embedding error:', err.message)
      setError(`Embedding error: ${err.message}`)
    }

    // 4. Refresh UI
    fetchFiles()
    setUploading(false)
    e.target.value = '' // reset input
  }

const handleDeleteFile = async (file: any) => {
  const confirmed = window.confirm(
    `Delete file "${file.file_path.split('/').pop()}" and its embeddings?`
  )
  if (!confirmed) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch(`/api/chatbot-files/file/${file.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `Failed with status ${res.status}`)
    }

    setFiles(files.filter((f) => f.id !== file.id))
  } catch (err: any) {
    setError(err.message)
  }
}


  const limitReached = plan === 'free' && files.length >= 3

  return (
    <div className="mt-3">
      <input
        type="file"
        accept=".txt,.pdf"
        onChange={handleFileUpload}
        disabled={limitReached || uploading}
        className={limitReached ? 'opacity-50 cursor-not-allowed' : ''}
      />
      {uploading && <p className="text-blue-600">Uploading & processing...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {limitReached && (
        <p className="text-red-600 mt-2">
          Free plan limit reached (3 files). Upgrade to Pro to upload more.
        </p>
      )}

      <ul className="mt-2 space-y-1">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex justify-between items-center text-sm text-gray-600 border-b pb-1"
          >
            <a
              href={f.signedUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {f.file_path.split('/').pop()}
            </a>
            <button
              onClick={() => handleDeleteFile(f)}
              className="text-red-600 hover:underline ml-2"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
