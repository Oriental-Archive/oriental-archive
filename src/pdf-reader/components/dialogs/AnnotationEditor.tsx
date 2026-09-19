import { useState } from "react";
import { Trash2, FolderPlus } from "lucide-react";
import { Modal } from "@/pdf-reader/components/common/Modal";
import type { Annotation, HighlightColor } from "@/pdf-reader/types";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

export function AnnotationEditor({
  annotation,
  onUpdate,
  onDelete,
  onAddToNotes,
  onClose,
}: {
  annotation: Annotation;
  onUpdate: (patch: Partial<Annotation>) => void;
  onDelete: () => void;
  /** Omitted for annotation types with no text anchor (area/drawing) — there's nothing to quote. */
  onAddToNotes?: () => void;
  onClose: () => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Modal title={`${annotation.type[0].toUpperCase()}${annotation.type.slice(1)} — page ${annotation.page}`} onClose={onClose} width={400}>
      {annotation.selectedText && (
        <blockquote className="mb-3 rounded-md bg-background-secondary p-2.5 text-[13px] italic text-text-secondary">
          &ldquo;{annotation.selectedText}&rdquo;
        </blockquote>
      )}

      <div className="mb-3 flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={annotation.color === c}
            onClick={() => onUpdate({ color: c })}
            className="h-5 w-5 rounded-full"
            style={{
              background: HIGHLIGHT_COLOR_VARS[c],
              outline: annotation.color === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
              outlineOffset: 1,
            }}
          />
        ))}
      </div>

      <textarea
        value={annotation.comment}
        onChange={(e) => onUpdate({ comment: e.target.value })}
        placeholder="Add a note…"
        rows={3}
        maxLength={5000}
        className="mb-3 w-full rounded-md border border-border bg-transparent p-2 text-[13px] focus-visible:outline-2 focus-visible:outline-accent"
      />

      <div className="mb-3">
        <div className="mb-1.5 flex flex-wrap gap-1">
          {annotation.tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-text-secondary">
              {t}
              <button type="button" onClick={() => onUpdate({ tags: annotation.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!tagDraft.trim()) return;
            onUpdate({ tags: [...annotation.tags, tagDraft.trim()] });
            setTagDraft("");
          }}
        >
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="Add tag and press Enter"
            className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs"
          />
        </form>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-secondary">Delete this annotation?</span>
            <button type="button" onClick={onDelete} className="font-medium text-danger">
              Delete
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="text-text-muted">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1.5 text-xs text-danger">
            <Trash2 size={13} />
            Delete
          </button>
        )}
        {onAddToNotes && !confirmingDelete && (
          <button type="button" onClick={onAddToNotes} className="flex items-center gap-1.5 text-xs text-accent">
            <FolderPlus size={13} />
            Add to notes
          </button>
        )}
      </div>
    </Modal>
  );
}
