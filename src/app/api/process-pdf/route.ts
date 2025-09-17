export const runtime = "edge"

import { NextResponse } from "next/server"
import OpenAI from "openai"
import { extractText } from "unpdf"
import { getAdminSupabase, assertWithinPlanLimit, logUsage, countTokensForArray } from "@/lib/usage"

// ✅ Chunk helper
function chunkText(text: string, chunkSize = 1000): string[] {
  const words = text.split(/\s+/)
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const chatbotId = formData.get("chatbotId") as string
    const fileId = formData.get("fileId") as string
    const file = formData.get("file") as File

    if (!chatbotId || !fileId || !file) {
      return NextResponse.json({ error: "Missing chatbotId, fileId, or file" }, { status: 400 })
    }

    const chatbotIdNum = Number(chatbotId)
    const fileIdNum = Number(fileId)

    const admin = getAdminSupabase()

    // ✅ Find chatbot owner
    const { data: chatbot, error: chatbotError } = await admin
      .from("chatbots")
      .select("user_id")
      .eq("id", chatbotIdNum)
      .single()
    if (chatbotError || !chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 })
    }
    const userId = chatbot.user_id

    // ✅ Extract text
    const uint8array = new Uint8Array(await file.arrayBuffer())
    const { text } = await extractText(uint8array, { mergePages: true })
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text found in PDF" }, { status: 400 })
    }

    const chunks = chunkText(text)
    const estimatedTokens = await countTokensForArray(chunks)

    // ✅ Enforce plan
    await assertWithinPlanLimit(admin, userId, estimatedTokens)

    // ✅ Generate embeddings with ada-002 (1536 dims)
    const model = "text-embedding-ada-002"
    for (const chunk of chunks) {
      const emb = await openai.embeddings.create({ model, input: chunk })
      const vector = emb.data[0].embedding

      const { error } = await admin.from("chatbot_embeddings").insert({
        chatbot_id: chatbotIdNum,
        file_id: fileIdNum,
        content: chunk,
        embedding: vector,
      })
      if (error) throw error
    }

    // ✅ Log usage
    await logUsage(admin, {
      userId,
      chatbotId: chatbotIdNum,
      type: "embed",
      tokens: estimatedTokens,
    })

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err: any) {
    console.error("PDF processing error:", err.message)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: err?.status || 500 })
  }
}
