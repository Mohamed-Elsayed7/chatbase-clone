import { NextResponse } from "next/server"
import OpenAI from "openai"
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

export const dynamic = "force-dynamic"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    const userId = form.get("userId") as string | null
    const chatbotId = form.get("chatbotId") as string | null

    if (!file || !userId || !chatbotId) {
      return NextResponse.json({ error: "Missing file/userId/chatbotId" }, { status: 400 })
    }

    const text = await file.text()
    const chunks = chunkText(text, 1000)

    const estimatedTokens = await countTokensForArray(chunks)
    const admin = getAdminSupabase()

    // ✅ Enforce plan
    await assertWithinPlanLimit(admin, userId, estimatedTokens)

    // ✅ Save file metadata
    const { data: fileRow, error: fileErr } = await admin
      .from("chatbot_files")
      .insert({
        chatbot_id: Number(chatbotId),
        file_path: file.name,
      })
      .select("id")
      .single()
    if (fileErr) throw fileErr

    // ✅ Generate embeddings with ada-002 (1536 dims)
    const model = "text-embedding-ada-002"
    for (const chunk of chunks) {
      const emb = await openai.embeddings.create({ model, input: chunk })
      const vector = emb.data[0].embedding

      const { error: insErr } = await admin.from("chatbot_embeddings").insert({
        chatbot_id: Number(chatbotId),
        file_id: fileRow.id,
        content: chunk,
        embedding: vector,
      })
      if (insErr) throw insErr
    }

    // ✅ Log usage
    await logUsage(admin, {
      userId,
      chatbotId: Number(chatbotId),
      type: "embed",
      tokens: estimatedTokens,
    })

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (err: any) {
    console.error("TXT UPLOAD ERROR:", err.message)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: err?.status || 500 })
  }
}
