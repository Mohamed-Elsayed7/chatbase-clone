'use client'

import { useState, useEffect } from 'react'
import { processTxtFile, processPdfFile } from '@/lib/fileProcessor'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

export default function ChatbotFiles({ chatbotId, userId }: { chatbotId: number, userId: string }) {
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [plan, setPlan] = useState<string>('free')

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
      toast.error(`⚠️ ${err.message}`)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const file = e.target.files[0]
    const ext = file.name.split('.').pop()?.toLowerCase()

    setUploading(true)

    const filePath = `${chatbotId}/${file.name}`

    try {
      // 1. Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chatbot-files')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Insert metadata into chatbot_files table
      const { data: fileData, error: dbError } = await supabase
        .from('chatbot_files')
        .insert([{ chatbot_id: chatbotId, file_path: filePath }])
        .select()
        .maybeSingle()

      if (dbError) throw dbError
      const fileId = fileData.id

      // 3. Process file → embeddings
      if (ext === 'txt') {
        await processTxtFile(chatbotId, file, fileId)
      } else if (ext === 'pdf') {
        await processPdfFile(chatbotId, file, fileId)
      } else {
        toast('ℹ️ File uploaded but no embeddings created (unsupported type).')
      }

      toast.success('✅ File uploaded & processed')
      fetchFiles()
    } catch (err: any) {
      toast.error(`⚠️ ${err.message}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteFile = async (file: any) => {
    const confirmed = window.confirm(`Delete "${file.file_path.split('/').pop()}"?`)
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
      toast.success('🗑️ File deleted')
    } catch (err: any) {
      toast.error(`⚠️ ${err.message}`)
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
