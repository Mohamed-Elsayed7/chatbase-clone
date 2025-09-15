// src/app/api/process-pdf/route.ts
export const runtime = "edge";

import { NextResponse } from "next/server";
import { extractText } from "unpdf"; // Edge-friendly PDF text extraction
import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";

// simple, overlap-friendly chunker (char-based, word-safe)
function chunkText(
  text: string,
  size = 1500,
  overlap = 200
): string[] {
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    let chunk = text.slice(i, end);

    // try not to cut mid-word
    if (end < text.length) {
      const lastSpace = chunk.lastIndexOf(" ");
      if (lastSpace > size * 0.6) {
        chunk = chunk.slice(0, lastSpace);
      }
    }

    chunks.push(chunk.trim());
    if (end >= text.length) break;
    i += Math.max(chunk.length - overlap, 1);
  }

  return chunks.filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const chatbotId = form.get("chatbotId") as string | null;
    const file = form.get("file") as File | null;

    if (!chatbotId || !file) {
      return NextResponse.json(
        { error: "Missing chatbotId or file" },
        { status: 400 }
      );
    }

    // Edge-safe: File -> ArrayBuffer -> Uint8Array
    const uint8 = new Uint8Array(await file.arrayBuffer());

    // Extract text with unpdf (serverless/Edge friendly)
    // mergePages=true returns one big string
    const { text } = await extractText(uint8, { mergePages: true });

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "No extractable text found in PDF" },
        { status: 400 }
      );
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "No valid chunks produced" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Use modern embeddings model
    const model = "text-embedding-3-small";

    for (const chunk of chunks) {
      const resp = await openai.embeddings.create({
        model,
        input: chunk,
      });

      const embedding = resp.data[0].embedding;

      const { error: dbError } = await supabase
        .from("chatbot_embeddings")
        .insert([{ chatbot_id: Number(chatbotId), content: chunk, embedding }]);

      if (dbError) {
        // Bubble up so the route returns 500 and you see it in logs
        throw new Error(`Supabase insert failed: ${dbError.message}`);
      }
    }

    return NextResponse.json({ ok: true, chunks: chunks.length });
  } catch (e: any) {
    console.error("process-pdf error:", e);
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
