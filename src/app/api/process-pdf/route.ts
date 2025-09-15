import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";

// Utility: split text into smaller chunks
function chunkText(text: string, chunkSize = 1000): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (current.join(" ").length > chunkSize) {
      chunks.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) chunks.push(current.join(" "));
  return chunks;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const chatbotId = formData.get("chatbotId");

    if (!file || !chatbotId) {
      return NextResponse.json(
        { error: "Missing file or chatbotId" },
        { status: 400 }
      );
    }

    // Convert File → Buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const data = await pdf(buffer);
    const text = data.text;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text extracted from PDF" },
        { status: 400 }
      );
    }

    // Setup OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Split into chunks
    const chunks = chunkText(text);

    // Loop over chunks → embed + insert
    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;

      const { error } = await supabase.from("chatbot_embeddings").insert([
        {
          chatbot_id: Number(chatbotId),
          content: chunk,
          embedding,
        },
      ]);

      if (error) {
        console.error("❌ Supabase insert error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (err: any) {
    console.error("❌ PDF processing error:", err.message);
    return NextResponse.json(
      { error: "Failed to process PDF: " + err.message },
      { status: 500 }
    );
  }
}
