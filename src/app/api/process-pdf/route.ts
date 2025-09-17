export const runtime = "edge"

import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import { extractText } from "unpdf"

// ✅ Use service role client → bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const chatbotId = formData.get("chatbotId") as string
    const fileId = formData.get("fileId") as string
    const file = formData.get("file") as File

    if (!chatbotId || !fileId || !file) {
      return NextResponse.json(
        { error: "Missing chatbotId, fileId, or file" },
        { status: 400 }
      )
    }

    const chatbotIdNum = Number(chatbotId)
    const fileIdNum = Number(fileId)

    // ✅ Find chatbot (works with service role, bypassing RLS)
    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotIdNum)
      .single()

    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }

    const userId = chatbot.user_id

    // ✅ Fetch the user's plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single()

    // ✅ Enforce Free plan file limit (warn only from 4th file onwards)
    let planWarning: string | null = null
    if (profile?.plan === "free") {
      const { count } = await supabase
        .from("chatbot_files")
        .select("*", { count: "exact", head: true })
        .eq("chatbot_id", chatbotIdNum)

      if ((count ?? 0) >= 3) {
        planWarning = "Free plan limit reached. Upgrade to Pro for more uploads."
      }
    }

    // ✅ Extract text from PDF
    const uint8array = new Uint8Array(await file.arrayBuffer())
    const { text } = await extractText(uint8array, { mergePages: true })

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text found in PDF" }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const chunks = chunkText(text)

    // ✅ Generate embeddings + store
    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002", // keep consistent with your schema
        input: chunk,
      })

      const embedding = embeddingResponse.data[0].embedding

      await supabase.from("chatbot_embeddings").insert([
        {
          chatbot_id: chatbotIdNum,
          file_id: fileIdNum,
          content: chunk,
          embedding,
        },
      ])
    }

    return NextResponse.json({
      success: true,
      chunks: chunks.length,
      warning: planWarning, // null unless free user with 4th+ file
    })
  } catch (err: any) {
    console.error("PDF processing error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
