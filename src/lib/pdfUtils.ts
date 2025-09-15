import * as pdfjsLib from "pdfjs-dist";

// ❌ Disable worker (safe in API route, since single-threaded anyway)
pdfjsLib.GlobalWorkerOptions.workerSrc = null as any;

export async function extractPdfText(uint8array: Uint8Array): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: uint8array });
  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    fullText += strings.join(" ") + "\n";
  }

  return fullText;
}
