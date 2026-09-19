import { GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export { getDocument } from "pdfjs-dist";
export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
