export const runtime = "edge";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";
import { extractText } from "unpdf"; // Edge-friendly PDF parser

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
    const chatbotId = formData.get("chatbotId") as string;
    const fileId = formData.get("fileId") as string;
    const file = formData.get("file") as File;

    if (!chatbotId || !fileId || !file) {
      return NextResponse.json(
        { error: "Missing chatbotId, fileId, or file" },
        { status: 400 }
      );
    }

    // Convert to Uint8Array for unpdf
    const uint8array = new Uint8Array(await file.arrayBuffer());
    const { text } = await extractText(uint8array, { mergePages: true });

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "No text found in PDF" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const chunks = chunkText(text);

    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;

      await supabase.from("chatbot_embeddings").insert([
        {
          chatbot_id: Number(chatbotId),
          file_id: Number(fileId),
          content: chunk,
          embedding,
        },
      ]);
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (err: any) {
    console.error("PDF processing error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
