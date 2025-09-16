import { NextResponse } from "next/server"
import pdf from "pdf-parse"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

// ✅ Use service role client → bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Utility: chunk text into smaller parts for embeddings
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File
    const chatbotId = formData.get("chatbotId") as string
    const fileId = formData.get("fileId") as string

    if (!file || !chatbotId || !fileId) {
      return NextResponse.json(
        { error: "Missing file, chatbotId, or fileId" },
        { status: 400 }
      )
    }

    const chatbotIdNum = Number(chatbotId)
    const fileIdNum = Number(fileId)

    // ✅ Find chatbot owner (user_id)
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotIdNum)
      .single()

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    const userId = chatbot.user_id

    // ✅ Fetch user plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single()

    // ✅ Enforce Free plan limit (max 3 files)
    if (profile?.plan === "free") {
      const { count } = await supabase
        .from("chatbot_files")
        .select("*", { count: "exact", head: true })
        .eq("chatbot_id", chatbotIdNum)

      if ((count ?? 0) >= 3) {
        return NextResponse.json(
          { error: "Free plan limit reached. Upgrade to Pro." },
          { status: 403 }
        )
      }
    }

    // Convert file to Buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text
    const data = await pdf(buffer)
    const text = data.text

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "No text found in file" },
        { status: 400 }
      )
    }

    // Split into chunks
    const chunks = chunkText(text)

    // Setup OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Process chunks into embeddings
    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      })

      const embedding = embeddingResponse.data[0].embedding

      const { error } = await supabase.from("chatbot_embeddings").insert([
        {
          chatbot_id: chatbotIdNum,
          file_id: fileIdNum,
          content: chunk,
          embedding,
        },
      ])

      if (error) {
        console.error("Supabase insert error:", error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err: any) {
    console.error("Processing file failed:", err.message)
    return NextResponse.json(
      { error: "Failed to process file: " + err.message },
      { status: 500 }
    )
  }
}
