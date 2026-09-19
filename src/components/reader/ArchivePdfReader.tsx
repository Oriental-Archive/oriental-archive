"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createAnnotationStore, type Annotation } from "@/lib/annotation-store";
import type { RecordStore } from "@/pdf-reader/lib/siteRecords";
import type { ReaderHost } from "@/pdf-reader/components/ReaderShell";
import "@/pdf-reader/reader.css";

// pdf.js needs browser-only APIs (DOMMatrix, canvas) that don't exist during
// Next's server render pass, so the reader itself is loaded client-side only —
// same as the classic PdfReader in ReaderShell.tsx.
const ReaderShell = dynamic(() => import("@/pdf-reader/components/ReaderShell").then((m) => m.ReaderShell), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-sm text-muted">Opening document…</div>
  ),
});

// The PDF reader (src/pdf-reader) takes everything site-specific through one
// `host` object; this is the only place that knows how the site's book,
// annotation store and permissions map onto it. The classic PdfReader stays
// available at ?reader=classic (see app/books/[id]/read/page.tsx).
export function ArchivePdfReader(props: {
  bookId: string;
  bookTitle: string;
  author: string | null;
  fileName: string;
  documentVersionId: string;
  fileUrl: string;
  signedIn: boolean;
  initialAnnotations: Annotation[];
  canDownload: boolean;
  citationDefaults: NonNullable<ReaderHost["citationDefaults"]>;
}) {
  const router = useRouter();
  const { bookId, documentVersionId, signedIn, initialAnnotations } = props;

  const host = useMemo<ReaderHost>(() => {
    const store = createAnnotationStore(bookId, signedIn);
    const records: RecordStore = {
      // Signed-in annotations were already loaded server-side; anonymous ones
      // live in this browser's IndexedDB and are read here.
      list: () => (signedIn ? Promise.resolve(initialAnnotations) : store.list(documentVersionId)),
      create: (r) =>
        store.create({
          id: r.id,
          documentVersionId,
          location: r.location,
          selectedText: r.selectedText ?? undefined,
          highlightData: r.highlightData,
          note: r.note ?? undefined,
        }),
      update: (id, patch) => store.update(id, patch),
      remove: (id) => store.remove(id),
    };
    return {
      documentId: documentVersionId,
      fileUrl: props.fileUrl,
      fileName: props.fileName,
      title: props.bookTitle,
      author: props.author,
      store: records,
      permissions: {
        view: true,
        annotate: true,
        copyText: true,
        exportAnnotations: true,
        download: props.canDownload,
        print: props.canDownload,
      },
      downloadUrl: `/api/books/${bookId}/file?type=document&mode=download`,
      citationDefaults: {
        ...props.citationDefaults,
        url: typeof window === "undefined" ? "" : `${window.location.origin}/books/${bookId}`,
      },
      onExit: () => router.push(`/books/${bookId}`),
    };
    // The host is built once per book/version: rebuilding it would hand the
    // reader a new store mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, documentVersionId, signedIn]);

  return <ReaderShell host={host} />;
}
