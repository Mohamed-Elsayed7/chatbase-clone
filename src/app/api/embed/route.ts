import { NextResponse } from "next/server";
import OpenAI from "openai";
import { supabase } from "@/lib/supabaseClient";

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
    const { chatbotId, text } = await req.json();

    if (!chatbotId || !text) {
      return NextResponse.json({ error: "Missing chatbotId or text" }, { status: 400 });
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
        { chatbot_id: Number(chatbotId), content: chunk, embedding },
      ]);
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (err: any) {
    console.error("Embedding API error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
