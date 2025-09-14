'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ChatbotFiles({ chatbotId, userId }: { chatbotId: number, userId: string }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<any[]>([])

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

    setUploading(true)
    setError(null)

    const filePath = `${userId}/${chatbotId}/${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('chatbot-files')
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }
    console.log("Inserting into chatbot_files:", {
    chatbot_id: chatbotId,
    file_path: filePath
    });

    const { error: dbError } = await supabase.from('chatbot_files').insert([
      { chatbot_id: chatbotId, file_path: filePath }
    ])
    
    console.log("DB Error:", dbError);
    
    if (dbError) setError(dbError.message)
    else fetchFiles()

    setUploading(false)
    e.target.value = '' // reset input
  }

  return (
    <div className="mt-3">
      <input type="file" onChange={handleFileUpload} />
      {uploading && <p className="text-blue-600">Uploading...</p>}
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
