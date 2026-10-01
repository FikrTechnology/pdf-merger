import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { saveAs } from "file-saver";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const PDF_MIME_TYPE = "application/pdf";

/** Accepts the canonical PDF MIME type, falling back to the file extension. */
export function isPdfFile(file) {
  if (!file) return false;
  if (file.type === PDF_MIME_TYPE) return true;
  return typeof file.name === "string" && file.name.toLowerCase().endsWith(".pdf");
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Files can be read repeatedly; always request a fresh buffer per consumer to avoid detached-buffer bugs. */
export function readFileAsArrayBuffer(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function loadPdfJsDocument(data) {
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

export async function renderPdfPageToCanvas(pdfDoc, pageNumber, canvas, { scale = 1, rotation } = {}) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  const context = canvas.getContext("2d");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return viewport;
}

export function moveItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length) return list;
  const next = Array.from(list);
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: PDF_MIME_TYPE });
  saveAs(blob, filename);
}

export function buildOutputFileName(originalName, suffix, extension = "pdf") {
  const base = (originalName || "document").replace(/\.pdf$/i, "");
  return `${base}-${suffix}.${extension}`;
}

/** Translates low-level pdf-lib/pdfjs errors into messages a non-technical user can act on. */
export function getFriendlyErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (/password|encrypt/i.test(message)) {
    return "File PDF dilindungi kata sandi sehingga tidak dapat diproses.";
  }
  if (/invalid pdf|corrupt|header|structure/i.test(message)) {
    return "File PDF tampak rusak atau bukan format PDF yang valid.";
  }
  return "Terjadi kesalahan saat memproses file PDF. Pastikan file valid lalu coba lagi.";
}

export { pdfjsLib };
