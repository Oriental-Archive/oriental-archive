"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Field, Select } from "@/components/ui/Field";

export type CollectionBookEntry = { id: string; book: { id: string; title: string } };

export function CollectionBooksManager(props: {
  collectionId: string;
  entries: CollectionBookEntry[];
  availableBooks: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");

  const usedBookIds = new Set(props.entries.map((e) => e.book.id));
  const candidateBooks = props.availableBooks.filter((b) => !usedBookIds.has(b.id));

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBookId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/collections/${props.collectionId}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: selectedBookId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add.");
        return;
      }
      setSelectedBookId("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBook(bookId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/collections/${props.collectionId}/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't remove that book — please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reorder(newOrder: CollectionBookEntry[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/collections/${props.collectionId}/books/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds: newOrder.map((e) => e.id) }),
      });
      if (!res.ok) {
        setError("Couldn't reorder — please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= props.entries.length) return;
    const next = [...props.entries];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {props.entries.length === 0 && <p className="text-sm text-muted">No books added yet.</p>}
      <ul className={props.entries.length > 0 ? "flex flex-col divide-y divide-border border-t border-b border-border" : ""}>
        {props.entries.map((entry, i) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 py-3">
            <span dir="auto" className="text-sm text-foreground">
              {entry.book.title}
            </span>
            <div className="flex shrink-0 gap-1 text-xs">
              <Button
                variant="secondary"
                size="icon"
                disabled={busy || i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                size="icon"
                disabled={busy || i === props.entries.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </Button>
              <ConfirmButton
                label="Remove"
                size="sm"
                disabled={busy}
                confirmTitle={`Remove "${entry.book.title}" from this collection?`}
                confirmDescription="The book itself isn't deleted — it's just taken out of this collection."
                onConfirm={() => removeBook(entry.book.id)}
              />
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={addBook} className="flex items-end gap-2">
        <Field label="Add a book" className="min-w-48">
          <Select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)}>
            <option value="">Select a book…</option>
            {candidateBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="sm" disabled={busy || !selectedBookId}>
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
