// Utility: split text into smaller chunks for embeddings
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

// Process TXT file (client-side, then send to API route)
export async function processTxtFile(chatbotId: number, file: File) {
  const text = await file.text();
  const chunks = chunkText(text);

  // Send each chunk to the server API for embedding
  for (const chunk of chunks) {
    await fetch("/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId, text: chunk }),
    });
  }
}
