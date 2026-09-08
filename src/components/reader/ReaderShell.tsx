"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createAnnotationStore, type Annotation, type AnnotationInput } from "@/lib/annotation-store";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Textarea } from "@/components/ui/Field";

// All three rely on browser-only APIs (DOMMatrix, IndexedDB, canvas) that
// don't exist during Next's server render pass, so they're loaded
// client-side only rather than statically imported.
const PdfReader = dynamic(() => import("@/components/reader/PdfReader").then((m) => m.PdfReader), {
  ssr: false,
});
const EpubReader = dynamic(() => import("@/components/reader/EpubReader").then((m) => m.EpubReader), {
  ssr: false,
});
const DocxReader = dynamic(() => import("@/components/reader/DocxReader").then((m) => m.DocxReader), {
  ssr: false,
});

export type ReaderApi = {
  jumpTo: (location: unknown) => void;
};

export type SubReaderProps = {
  fileUrl: string;
  annotations: Annotation[];
  // Resolves to whether it actually saved — a reader calls this from a
  // "Highlight"/"Bookmark this page" button and needs to know whether to
  // clear its pending-selection state or leave it for the reader to retry.
  onCreate: (input: Omit<AnnotationInput, "documentVersionId">) => Promise<boolean>;
  apiRef: React.RefObject<ReaderApi | null>;
};

export function ReaderShell(props: {
  bookId: string;
  bookTitle: string;
  documentVersionId: string;
  mimeType: string;
  fileUrl: string;
  signedIn: boolean;
  initialAnnotations: Annotation[];
}) {
  const [store] = useState(() => createAnnotationStore(props.bookId, props.signedIn));
  const [annotations, setAnnotations] = useState<Annotation[]>(props.initialAnnotations);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<ReaderApi | null>(null);

  // Anonymous visitors' annotations live only in this browser's IndexedDB
  // (spec §22) — the server never rendered any initial ones for them, so
  // load here once the client is up.
  useEffect(() => {
    if (!props.signedIn) {
      // Anonymous highlights live only in this browser's IndexedDB, which
      // can reject (blocked storage, some private-browsing modes). Without
      // this .catch(), that previously left a returning visitor's own
      // highlights silently missing from the sidebar — indistinguishable
      // from genuinely having none — with no indication anything failed.
      store
        .list(props.documentVersionId)
        .then(setAnnotations)
        .catch(() => setError("Couldn't load your saved highlights for this book."));
    }
  }, [props.signedIn, props.documentVersionId, store]);

  async function handleCreate(input: Omit<AnnotationInput, "documentVersionId">): Promise<boolean> {
    setError(null);
    try {
      const created = await store.create({ ...input, documentVersionId: props.documentVersionId });
      setAnnotations((prev) => [...prev, created]);
      return true;
    } catch {
      setError("Couldn't save that — please try again.");
      return false;
    }
  }

  // Optimistic, but not silently so — a delete/save that doesn't actually
  // persist (expired session, dropped connection) previously looked
  // identical to a successful one, only to resurface as a confusing
  // discrepancy the next time this book was opened.
  async function handleDelete(id: string) {
    const previous = annotations;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setError(null);
    if (!(await store.remove(id))) {
      setAnnotations(previous);
      setError("Couldn't remove that — please try again.");
    }
  }

  async function handleUpdateNote(id: string, note: string): Promise<boolean> {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, note } : a)));
    return store.update(id, { note });
  }

  const highlights = annotations.filter((a) => a.highlightData != null);
  const bookmarks = annotations.filter((a) => a.highlightData == null);

  const subReaderProps: SubReaderProps = {
    fileUrl: props.fileUrl,
    annotations,
    onCreate: handleCreate,
    apiRef,
  };

  return (
    <div className="flex h-screen flex-col bg-navy">
      <header className="flex items-center justify-between border-b border-white/10 bg-navy px-4 py-2 text-background">
        <div className="flex items-center gap-3 overflow-hidden">
          <Link href={`/books/${props.bookId}`} className="text-sm text-background/70 hover:text-gold">
            ← Back
          </Link>
          <h1 dir="auto" className="truncate font-serif text-sm">
            {props.bookTitle}
          </h1>
        </div>
        <Button variant="toolbar" size="sm" onClick={() => setSidebarOpen((v) => !v)}>
          {sidebarOpen ? "Hide" : "Show"} Highlights & Bookmarks
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {props.mimeType === "application/pdf" && <PdfReader {...subReaderProps} />}
          {props.mimeType === "application/epub+zip" && <EpubReader {...subReaderProps} />}
          {props.mimeType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && (
            <DocxReader {...subReaderProps} />
          )}
        </div>

        {sidebarOpen && (
          // A side panel only fits alongside the reader on a wide-enough
          // screen (spec-driven: the reader itself must stay usable) — on
          // mobile it becomes a full-screen overlay instead, dismissed with
          // the same Hide button.
          <aside className="fixed inset-0 z-20 overflow-y-auto bg-background p-4 sm:static sm:inset-auto sm:z-auto sm:w-72 sm:shrink-0 sm:border-l sm:border-white/10">
            {error && <p className="mb-3 text-xs text-danger">{error}</p>}
            <section>
              <h2 className="font-serif text-sm text-foreground">Bookmarks</h2>
              {bookmarks.length === 0 && <p className="mt-1 text-xs text-muted">None yet.</p>}
              <ul className="mt-2 flex flex-col gap-2">
                {bookmarks.map((b) => (
                  <Card as="li" key={b.id} padding="sm" className="text-xs">
                    <button
                      type="button"
                      onClick={() => apiRef.current?.jumpTo(b.location)}
                      className="text-left text-foreground hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      {b.note || "Saved location"}
                    </button>
                    <ConfirmButton
                      label="Remove"
                      variant="ghost"
                      size="inline"
                      className="ml-2"
                      confirmTitle="Remove this bookmark?"
                      onConfirm={() => handleDelete(b.id)}
                    />
                  </Card>
                ))}
              </ul>
            </section>

            <section className="mt-6">
              <h2 className="font-serif text-sm text-foreground">Highlights</h2>
              {highlights.length === 0 && <p className="mt-1 text-xs text-muted">None yet.</p>}
              <ul className="mt-2 flex flex-col gap-3">
                {highlights.map((h) => (
                  <Card as="li" key={h.id} padding="sm" className="text-xs">
                    <button
                      type="button"
                      onClick={() => apiRef.current?.jumpTo(h.location)}
                      dir="auto"
                      className="line-clamp-3 text-left text-foreground hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      &ldquo;{h.selectedText}&rdquo;
                    </button>
                    <NoteEditor
                      note={h.note ?? ""}
                      onSave={(note) => handleUpdateNote(h.id, note)}
                    />
                    <ConfirmButton
                      label="Remove highlight"
                      variant="ghost"
                      size="inline"
                      className="mt-1"
                      confirmTitle="Remove this highlight?"
                      onConfirm={() => handleDelete(h.id)}
                    />
                  </Card>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

function NoteEditor({ note, onSave }: { note: string; onSave: (note: string) => Promise<boolean> }) {
  const [value, setValue] = useState(note);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setFailed(false);
        }}
        onBlur={async () => {
          if (value === note) return;
          setFailed(!(await onSave(value)));
        }}
        placeholder="Add a note…"
        rows={2}
        className="mt-1 w-full text-xs"
      />
      {failed && <p className="mt-1 text-xs text-danger">Not saved — try again.</p>}
    </>
  );
}
