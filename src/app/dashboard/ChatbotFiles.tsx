'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { processTxtFile } from '@/lib/fileProcessor'

export default function ChatbotFiles({ chatbotId, userId }: { chatbotId: number, userId: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<any[]>([])

  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('chatbot_files')
      .select('*')
      .eq('chatbot_id', chatbotId)
      .order('created_at', { ascending: false })

    if (!error && data) setFiles(data)
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
    const { error: dbError } = await supabase.from('chatbot_files').insert([
      { chatbot_id: chatbotId, file_path: filePath }
    ])

    if (dbError) {
      setError(dbError.message)
      setUploading(false)
      return
    }

    // 3. Process file → embeddings
    try {
      if (ext === 'txt') {
        await processTxtFile(chatbotId, file)
      } else if (ext === 'pdf') {
        // Send PDF to server-side API for processing
        const formData = new FormData()
        formData.append('file', file)
        formData.append('chatbotId', chatbotId.toString())

        const res = await fetch('/api/process-pdf', {
          method: 'POST',
          body: formData
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to process PDF')
        }
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

  return (
    <div className="mt-3">
      <input type="file" onChange={handleFileUpload} />
      {uploading && <p className="text-blue-600">Uploading & processing...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <ul className="mt-2 space-y-1">
        {files.map((f) => (
          <li key={f.id} className="text-sm text-gray-600">
            {f.file_path}
          </li>
        ))}
      </ul>
    </div>
  )
}
