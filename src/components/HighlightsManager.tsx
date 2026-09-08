"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listAllLocalAnnotations,
  deleteLocalAnnotation,
  updateLocalAnnotation,
} from "@/lib/local-annotations";
import type { Annotation } from "@/lib/annotation-store";
import { Card } from "@/components/ui/Card";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Textarea } from "@/components/ui/Field";

type BookSummary = { id: string; title: string };

// Signed-in highlights come from the database, already loaded server-side.
// Anonymous ones live only in this browser's IndexedDB (spec §22), so they're
// loaded here on mount instead — remove/edit-note calls branch the same way
// annotation-store.ts does, without needing that facade's per-book `list`/
// `create` (this page only ever removes or edits an existing row by id).
export function HighlightsManager(props: {
  signedIn: boolean;
  initialAnnotations: Annotation[];
  initialBooks: BookSummary[];
}) {
  const [annotations, setAnnotations] = useState(props.initialAnnotations);
  const [books, setBooks] = useState(props.initialBooks);
  const [loading, setLoading] = useState(!props.signedIn);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.signedIn) return;
    listAllLocalAnnotations()
      .then(async (all) => {
        setAnnotations(all);
        const ids = [...new Set(all.map((a) => a.bookId))];
        if (ids.length > 0) {
          const res = await fetch(`/api/books/summaries?ids=${ids.join(",")}`);
          setBooks(res.ok ? await res.json() : []);
        }
        setLoading(false);
      })
      .catch(() => {
        // IndexedDB can reject (blocked storage, some private-browsing
        // modes) — without this, that left the page stuck on "Loading…"
        // forever with no way out.
        setError("Couldn't load your highlights — try reloading the page.");
        setLoading(false);
      });
  }, [props.signedIn]);

  // Optimistic, but not silently so — a delete that doesn't actually persist
  // (session expired, network drop) previously vanished from the list
  // anyway with no sign anything went wrong, only to reappear on the next
  // visit looking like a random glitch. Now it's put back with an explanation.
  async function remove(id: string) {
    const previous = annotations;
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setError(null);
    const ok = await (props.signedIn
      ? fetch(`/api/annotations/${id}`, { method: "DELETE" }).then((r) => r.ok)
      : deleteLocalAnnotation(id).then(() => true)
    ).catch(() => false);
    if (!ok) {
      setAnnotations(previous);
      setError("Couldn't remove that — please try again.");
    }
  }

  // Returns whether the save actually stuck, so the note editor can tell the
  // difference between "saved" and "looks saved but wasn't" instead of
  // silently discarding a failure the way remove() used to.
  async function updateNote(id: string, note: string): Promise<boolean> {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, note } : a)));
    return (props.signedIn
      ? fetch(`/api/annotations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }).then((r) => r.ok)
      : updateLocalAnnotation(id, { note }).then(() => true)
    ).catch(() => false);
  }

  if (loading) {
    return <p className="mt-10 text-sm text-muted">Loading…</p>;
  }

  const byBook = new Map<string, Annotation[]>();
  for (const a of annotations) {
    byBook.set(a.bookId, [...(byBook.get(a.bookId) ?? []), a]);
  }
  const titleById = new Map(books.map((b) => [b.id, b.title]));

  if (byBook.size === 0) {
    return (
      <p className="mt-10 text-sm text-muted">
        No bookmarks or highlights yet — make some while reading a book.
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      {error && <p className="text-sm text-danger">{error}</p>}
      {[...byBook.entries()].map(([bookId, items]) => {
        const bookmarks = items.filter((a) => a.highlightData == null);
        const highlights = items.filter((a) => a.highlightData != null);
        return (
          <div key={bookId}>
            <Link
              href={`/books/${bookId}/read`}
              dir="auto"
              className="font-serif text-lg text-foreground hover:text-burgundy"
            >
              {titleById.get(bookId) ?? "Untitled book"}
            </Link>

            {bookmarks.length > 0 && (
              <div className="mt-4">
                <h3 className="font-serif text-sm text-foreground">Bookmarks</h3>
                <ul className="mt-2 divide-y divide-border border-t border-b border-border">
                  {bookmarks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span dir="auto" className="text-foreground">
                        {b.note || "Saved location"}
                      </span>
                      <ConfirmButton
                        label="Remove"
                        variant="ghost"
                        size="inline"
                        className="shrink-0 text-xs"
                        confirmTitle="Remove this bookmark?"
                        onConfirm={() => remove(b.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {highlights.length > 0 && (
              <div className="mt-4">
                <h3 className="font-serif text-sm text-foreground">Highlights</h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {highlights.map((h) => (
                    <Card as="li" key={h.id} padding="md" className="text-sm">
                      <p dir="auto" className="text-foreground">
                        &ldquo;{h.selectedText}&rdquo;
                      </p>
                      <NoteEditor note={h.note ?? ""} onSave={(note) => updateNote(h.id, note)} />
                      <ConfirmButton
                        label="Remove highlight"
                        variant="ghost"
                        size="inline"
                        className="mt-1 text-xs"
                        confirmTitle="Remove this highlight?"
                        onConfirm={() => remove(h.id)}
                      />
                    </Card>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
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
        className="mt-2 w-full text-xs"
      />
      {failed && <p className="mt-1 text-xs text-danger">Not saved — try again.</p>}
    </>
  );
}
