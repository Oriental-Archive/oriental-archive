import { useCallback, useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "@/pdf-reader/lib/pdf";
import type { DocumentMetadata, OutlineNode } from "@/pdf-reader/types";

type Status = "idle" | "loading" | "password-required" | "error" | "loaded";

type PdfMetadataInfo = {
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
};

async function readOutline(pdf: PDFDocumentProxy): Promise<OutlineNode[]> {
  type RawOutlineItem = {
    title: string;
    dest: unknown;
    items: RawOutlineItem[];
  };
  const raw = (await pdf.getOutline()) as RawOutlineItem[] | null;
  if (!raw) return [];

  async function resolve(items: RawOutlineItem[]): Promise<OutlineNode[]> {
    const nodes: OutlineNode[] = [];
    for (const item of items) {
      let page: number | null = null;
      try {
        const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
        const ref = Array.isArray(dest) ? dest[0] : null;
        if (ref) page = (await pdf.getPageIndex(ref)) + 1;
      } catch {
        page = null;
      }
      nodes.push({ title: item.title, page, children: await resolve(item.items ?? []) });
    }
    return nodes;
  }
  return resolve(raw);
}

export type PdfSource = {
  url: string;
  /** Shown as the document's file name (the site's own title beats whatever the PDF calls itself). */
  fileName: string;
  title: string;
  author: string | null;
};

/**
 * Loads the book's PDF from its URL. pdf.js fetches it itself, in ranges, so
 * the first page appears before a large scanned book has finished
 * downloading. Not `withCredentials`: the file endpoint redirects to a
 * cross-origin signed URL, and S3-style CORS can't grant
 * Access-Control-Allow-Credentials — the default still sends cookies on the
 * same-origin first hop, which is all the endpoint needs.
 */
export function usePdfDocument(source: PdfSource) {
  const [status, setStatus] = useState<Status>("loading");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState<string | undefined>(undefined);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url: source.url, password, withCredentials: false });
    setStatus("loading");
    setError(null);

    task.promise
      .then(async (doc) => {
        const [info, outlineNodes] = await Promise.all([
          doc.getMetadata().catch(() => null),
          readOutline(doc).catch(() => []),
        ]);
        if (cancelled) return;
        const pdfInfo = (info?.info ?? {}) as PdfMetadataInfo;
        const src = sourceRef.current;
        setMetadata({
          title: src.title,
          author: src.author ?? (pdfInfo.Author || null),
          subject: pdfInfo.Subject || null,
          keywords: pdfInfo.Keywords || null,
          creator: pdfInfo.Creator || null,
          producer: pdfInfo.Producer || null,
          creationDate: pdfInfo.CreationDate || null,
          modificationDate: pdfInfo.ModDate || null,
          language: null,
          fileName: src.fileName,
          fileSize: 0,
          pageCount: doc.numPages,
        });
        setOutline(outlineNodes);
        setPdf(doc);
        setStatus("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        if (name === "PasswordException") {
          setStatus("password-required");
          return;
        }
        setError(
          name === "InvalidPDFException"
            ? "This file is corrupted or isn't a valid PDF."
            : name === "MissingPDFException"
              ? "This document isn't available."
              : "Couldn't load this document."
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [source.url, password, attempt]);

  const submitPassword = useCallback((pw: string) => setPassword(pw), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, pdf, metadata, outline, error, submitPassword, retry };
}
