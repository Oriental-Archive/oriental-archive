import { useEffect, useState } from "react";
import { NotebookText, Plus, Trash2, Quote as QuoteIcon, X } from "lucide-react";
import type { Annotation, NoteQuote, ResearchNote } from "@/pdf-reader/types";
import { EmptyState } from "@/pdf-reader/components/common/EmptyState";

export function ResearchNotesPanel({
  notes,
  onCreate,
  onUpdate,
  onDelete,
  pendingQuote,
  onConsumePendingQuote,
  onNavigate,
  annotationsById,
}: {
  notes: ResearchNote[];
  onCreate: () => string;
  onUpdate: (id: string, patch: Partial<ResearchNote>) => void;
  onDelete: (id: string) => void;
  pendingQuote: { page: number; text: string; annotationId: string | null } | null;
  onConsumePendingQuote: () => void;
  onNavigate: (page: number) => void;
  annotationsById: Map<string, Annotation>;
}) {
  const [openId, setOpenId] = useState<string | null>(notes[0]?.id ?? null);
  const open = notes.find((n) => n.id === openId) ?? null;

  // The insert banner below only renders once a note is open — without this,
  // "Add to research notes" from the selection toolbar did nothing visible
  // whenever the panel was showing the notes list (e.g. no note opened yet
  // this session), since pendingQuote had nowhere to attach its UI to.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingQuote || openId) return;
    setOpenId(notes.length > 0 ? notes[notes.length - 1].id : onCreate());
  }, [pendingQuote]);

  function insertPendingQuote(targetId: string) {
    if (!pendingQuote) return;
    const note = notes.find((n) => n.id === targetId);
    if (!note) return;
    const quote: NoteQuote = { annotationId: pendingQuote.annotationId, page: pendingQuote.page, text: pendingQuote.text };
    onUpdate(targetId, {
      body: note.body ? `${note.body}\n\n> "${pendingQuote.text}" (p. ${pendingQuote.page})` : `> "${pendingQuote.text}" (p. ${pendingQuote.page})`,
      quotes: [...note.quotes, quote],
    });
    onConsumePendingQuote();
  }

  if (open) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b border-border p-2">
          <button type="button" onClick={() => setOpenId(null)} className="text-xs text-text-muted hover:text-text-primary">
            ← All notes
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(open.id);
              setOpenId(null);
            }}
            aria-label="Delete note"
            className="ml-auto text-text-muted hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {pendingQuote && (
          <div className="m-2 flex items-center gap-2 rounded-md bg-accent-subtle p-2 text-[11px] text-accent">
            <QuoteIcon size={13} className="shrink-0" />
            <span className="flex-1">Insert quoted passage from p. {pendingQuote.page}?</span>
            <button type="button" onClick={() => insertPendingQuote(open.id)} className="font-medium underline">
              Insert
            </button>
            <button type="button" onClick={onConsumePendingQuote} aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-3">
          <input
            value={open.title}
            onChange={(e) => onUpdate(open.id, { title: e.target.value })}
            placeholder="Untitled note"
            className="mb-2 w-full border-none bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
          />
          <textarea
            value={open.body}
            onChange={(e) => onUpdate(open.id, { body: e.target.value })}
            placeholder="Write while you read. Use the selection toolbar's Quote action to pull in a passage with its page reference."
            className="h-40 w-full resize-none border-none bg-transparent text-[13px] leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
          />

          {open.quotes.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <p className="text-[11px] font-medium text-text-muted">Linked passages</p>
              {open.quotes.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onNavigate(q.page)}
                  disabled={q.annotationId !== null && !annotationsById.has(q.annotationId)}
                  className="block w-full rounded-md border border-border px-2 py-1.5 text-left text-[11.5px] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  p.{q.page} — &ldquo;{q.text.slice(0, 60)}
                  {q.text.length > 60 ? "…" : ""}&rdquo;
                  {q.annotationId !== null && !annotationsById.has(q.annotationId) && (
                    <span className="ml-1 text-text-muted">(source removed)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <button
          type="button"
          onClick={() => setOpenId(onCreate())}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent"
        >
          <Plus size={13} />
          New note
        </button>
      </div>
      {notes.length === 0 ? (
        <EmptyState
          icon={<NotebookText size={22} strokeWidth={1.5} />}
          title="No research notes"
          description="Create notes while reading and link them directly to passages in the document. Research notes are kept in this browser only."
        />
      ) : (
        <div className="flex-1 overflow-auto">
          {notes.map((n) => (
            <button key={n.id} type="button" onClick={() => setOpenId(n.id)} className="block w-full border-b border-border/60 px-3 py-2 text-left hover:bg-surface-hover">
              <p className="truncate text-[13px] font-medium text-text-primary">{n.title || "Untitled note"}</p>
              <p className="line-clamp-2 text-[11.5px] text-text-muted">{n.body || "Empty note"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
