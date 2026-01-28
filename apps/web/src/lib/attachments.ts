import type { PdfAttachment } from "@/lib/externalContext";

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Invalid file data"));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export async function fileToAttachment(file: File): Promise<PdfAttachment> {
  const data = await fileToBase64(file);
  return {
    name: file.name,
    type: file.type || "application/pdf",
    data,
  };
}
