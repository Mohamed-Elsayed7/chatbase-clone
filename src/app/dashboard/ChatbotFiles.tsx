'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { processTxtFile, processPdfFile } from '@/lib/fileProcessor'

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

    if (!error && data) {
      // Attach signed URL for each file
      const filesWithUrls = await Promise.all(
        data.map(async (f) => {
          const { data: urlData } = await supabase.storage
            .from('chatbot-files')
            .createSignedUrl(f.file_path, 60 * 60) // 1 hour expiry
          return { ...f, signedUrl: urlData?.signedUrl }
        })
      )
      setFiles(filesWithUrls)
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

    // 2. Insert metadata into chatbot_files table and get fileId
    const { data: fileData, error: dbError } = await supabase
      .from('chatbot_files')
      .insert([{ chatbot_id: chatbotId, file_path: filePath }])
      .select()
      .single()

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
    const confirmed = window.confirm(`Delete file "${file.file_path.split('/').pop()}" and its embeddings?`)
    if (!confirmed) return

    // 1. Remove from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('chatbot-files')
      .remove([file.file_path])

    if (storageError) {
      setError(storageError.message)
      return
    }

    // 2. Remove from chatbot_files (embeddings cascade automatically)
    const { error: dbError } = await supabase
      .from('chatbot_files')
      .delete()
      .eq('id', file.id)

    if (dbError) {
      setError(dbError.message)
      return
    }

    // 3. Update UI
    setFiles(files.filter((f) => f.id !== file.id))
  }

  return (
    <div className="mt-3">
      <input type="file" accept=".txt,.pdf" onChange={handleFileUpload} />
      {uploading && <p className="text-blue-600">Uploading & processing...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <ul className="mt-2 space-y-1">
        {files.map((f) => (
          <li
            key={f.id}
            className="flex justify-between items-center text-sm text-gray-600 border-b pb-1"
          >
            {/* Filename as clickable link */}
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
