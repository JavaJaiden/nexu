import { extractPdfTextFromBase64, extractPdfTextFromUrl, extractPdfUrls } from "@/lib/pdf";
import { searchWeb } from "@/lib/search";

const MAX_SNIPPET_CHARS = 2400;

function trimText(value: string, limit = MAX_SNIPPET_CHARS) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
}

export type PdfAttachment = {
  name: string;
  type: string;
  data: string;
};

function isPdfAttachment(attachment: PdfAttachment) {
  return attachment.type === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
}

export async function buildExternalContext(question: string, attachments: PdfAttachment[] = []) {
  const urls = extractPdfUrls(question);
  const pdfResults: Array<{ url: string; text: string }> = [];
  for (const url of urls.slice(0, 2)) {
    try {
      const text = await extractPdfTextFromUrl(url);
      pdfResults.push({ url, text: trimText(text) });
    } catch {
      pdfResults.push({ url, text: "Unable to read PDF." });
    }
  }

  const attachmentResults: Array<{ label: string; text: string }> = [];
  for (const attachment of attachments.filter(isPdfAttachment).slice(0, 3)) {
    try {
      const text = await extractPdfTextFromBase64(attachment.data);
      attachmentResults.push({ label: attachment.name, text: trimText(text) });
    } catch {
      attachmentResults.push({ label: attachment.name, text: "Unable to read PDF." });
    }
  }

  let searchResults: Array<{ title: string; url: string; snippet: string }> = [];
  try {
    const response = await searchWeb(question, 5);
    searchResults = response.results;
  } catch {
    searchResults = [];
  }

  const parts: string[] = [];
  if (searchResults.length > 0) {
    parts.push(
      `Web search results:\n${searchResults
        .map(
          (result, index) =>
            `${index + 1}. ${result.title}\n${result.url}\n${trimText(result.snippet, 600)}`
        )
        .join("\n")}`
    );
  }

  if (pdfResults.length > 0) {
    parts.push(
      `PDF excerpts:\n${pdfResults
        .map((result, index) => `${index + 1}. ${result.url}\n${result.text}`)
        .join("\n")}`
    );
  }

  if (attachmentResults.length > 0) {
    parts.push(
      `Uploaded PDFs:\n${attachmentResults
        .map((result, index) => `${index + 1}. ${result.label}\n${result.text}`)
        .join("\n")}`
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : "";
}
