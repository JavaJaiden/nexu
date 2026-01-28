import pdfParse from "pdf-parse";

const MAX_PDF_BYTES = 6 * 1024 * 1024;

export function extractPdfUrls(text: string) {
  const urls: string[] = [];
  const regex = /(https?:\/\/[^\s)]+?\.pdf(?:\?[^\s)]+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  return Array.from(new Set(urls));
}

export async function extractPdfTextFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF too large");
  }
  const parsed = await pdfParse(buffer);
  return parsed.text ?? "";
}

export async function extractPdfTextFromBase64(encoded: string) {
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF too large");
  }
  const parsed = await pdfParse(buffer);
  return parsed.text ?? "";
}
