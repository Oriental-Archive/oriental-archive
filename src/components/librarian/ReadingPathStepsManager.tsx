"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

export type StepData = {
  id: string;
  order: number;
  explanation: string | null;
  book: { id: string; title: string };
};

export function ReadingPathStepsManager(props: {
  readingPathId: string;
  steps: StepData[];
  availableBooks: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [newExplanation, setNewExplanation] = useState("");

  const usedBookIds = new Set(props.steps.map((s) => s.book.id));
  const candidateBooks = props.availableBooks.filter((b) => !usedBookIds.has(b.id));

  async function addStep(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBookId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reading-paths/${props.readingPathId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: selectedBookId, explanation: newExplanation || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to add.");
        return;
      }
      setSelectedBookId("");
      setNewExplanation("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeStep(stepId: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reading-paths/${props.readingPathId}/steps/${stepId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't remove that step — please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updateExplanation(stepId: string, explanation: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/reading-paths/${props.readingPathId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explanation: explanation || null }),
      });
      if (res.ok) router.refresh();
      return res.ok;
    } catch {
      // A network throw here must resolve to false, not reject — the
      // caller (ExplanationEditor's onBlur) awaits this directly, and an
      // uncaught rejection would skip its "Not saved" message entirely.
      return false;
    }
  }

  async function reorder(newOrder: StepData[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reading-paths/${props.readingPathId}/steps/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds: newOrder.map((s) => s.id) }),
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
    if (target < 0 || target >= props.steps.length) return;
    const next = [...props.steps];
    [next[index], next[target]] = [next[target], next[index]];
    reorder(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {props.steps.length === 0 && <p className="text-sm text-muted">No books added yet.</p>}
      <ol className={props.steps.length > 0 ? "flex flex-col divide-y divide-border border-t border-b border-border" : ""}>
        {props.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3 py-3">
            <span className="font-serif text-lg text-gold">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span dir="auto" className="text-sm text-foreground">
                  {step.book.title}
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
                    disabled={busy || i === props.steps.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  <ConfirmButton
                    label="Remove"
                    size="sm"
                    disabled={busy}
                    confirmTitle={`Remove "${step.book.title}" from this reading path?`}
                    confirmDescription="The book itself isn't deleted — it's just taken out of this reading path."
                    onConfirm={() => removeStep(step.id)}
                  />
                </div>
              </div>
              <ExplanationEditor
                initial={step.explanation ?? ""}
                onSave={(v) => updateExplanation(step.id, v)}
              />
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={addStep} className="flex flex-wrap items-end gap-2">
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
        <Field label="Explanation (optional)" className="flex-1">
          <Input value={newExplanation} onChange={(e) => setNewExplanation(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" disabled={busy || !selectedBookId}>
          Add
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function ExplanationEditor({ initial, onSave }: { initial: string; onSave: (v: string) => Promise<boolean> }) {
  const [value, setValue] = useState(initial);
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
          if (value === initial) return;
          setFailed(!(await onSave(value)));
        }}
        placeholder="Explain why this book is here…"
        rows={2}
        className="mt-2 w-full text-xs"
      />
      {failed && <p className="mt-1 text-xs text-danger">Not saved — try again.</p>}
    </>
  );
}
