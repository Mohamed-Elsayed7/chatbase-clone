import { supabase } from "@/lib/supabaseClient"

// Utility: split text into smaller chunks for embeddings
function chunkText(text: string, chunkSize = 1000): string[] {
  const words = text.split(" ")
  const chunks: string[] = []
  let current: string[] = []

  for (const word of words) {
    current.push(word)
    if (current.join(" ").length > chunkSize) {
      chunks.push(current.join(" "))
      current = []
    }
  }
  if (current.length > 0) chunks.push(current.join(" "))
  return chunks
}

// Process TXT file → send text chunks to API
export async function processTxtFile(chatbotId: number, file: File, fileId: number) {
  const text = await file.text()
  const chunks = chunkText(text)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  for (const chunk of chunks) {
    await fetch("/api/embed", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ chatbotId, fileId, text: chunk }),
    })
  }
}

// Process PDF file → send file to API for server-side parsing
export async function processPdfFile(chatbotId: number, file: File, fileId: number) {
  const formData = new FormData()
  formData.append("chatbotId", chatbotId.toString())
  formData.append("fileId", fileId.toString())
  formData.append("file", file)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

  await fetch("/api/process-pdf", {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  })
}
