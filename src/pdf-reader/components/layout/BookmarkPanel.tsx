import { useState } from "react";
import { Bookmark as BookmarkIcon, Trash2 } from "lucide-react";
import type { Bookmark } from "@/pdf-reader/types";
import { EmptyState } from "@/pdf-reader/components/common/EmptyState";

export function BookmarkPanel({
  bookmarks,
  currentPage,
  onNavigate,
  onAdd,
  onUpdate,
  onDelete,
}: {
  bookmarks: Bookmark[];
  currentPage: number;
  onNavigate: (page: number) => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Bookmark>) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...bookmarks].sort((a, b) => a.page - b.page);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent"
        >
          <BookmarkIcon size={13} />
          Bookmark page {currentPage}
        </button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon size={22} strokeWidth={1.5} />}
          title="No bookmarks yet"
          description="Bookmark important pages to return to them quickly."
        />
      ) : (
        <div className="flex-1 overflow-auto">
          {sorted.map((b) => (
            <BookmarkRow key={b.id} bookmark={b} onNavigate={onNavigate} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookmarkRow({
  bookmark,
  onNavigate,
  onUpdate,
  onDelete,
}: {
  bookmark: Bookmark;
  onNavigate: (page: number) => void;
  onUpdate: (id: string, patch: Partial<Bookmark>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="group border-b border-border/60 px-3 py-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => onNavigate(bookmark.page)}
          className="flex h-6 min-w-[2.25rem] items-center justify-center rounded-md bg-accent-subtle text-[11px] font-medium text-accent"
        >
          p.{bookmark.page}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-1">
              <input
                autoFocus
                value={bookmark.title}
                onChange={(e) => onUpdate(bookmark.id, { title: e.target.value })}
                placeholder="Title"
                maxLength={200}
                className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs"
              />
              <textarea
                value={bookmark.note}
                onChange={(e) => onUpdate(bookmark.id, { note: e.target.value })}
                placeholder="Note"
                rows={2}
                maxLength={2000}
                className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs"
              />
              <input
                value={bookmark.tag}
                onChange={(e) => onUpdate(bookmark.id, { tag: e.target.value })}
                placeholder="Tag"
                className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs"
              />
              <button type="button" onClick={() => setEditing(false)} className="self-end text-[11px] text-accent">
                Done
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block w-full text-left">
              <p className="truncate text-[13px] text-text-primary">{bookmark.title || `Page ${bookmark.page}`}</p>
              {bookmark.note && <p className="truncate text-[11px] text-text-muted">{bookmark.note}</p>}
              {bookmark.tag && (
                <span className="mt-0.5 inline-block rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">
                  {bookmark.tag}
                </span>
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Delete bookmark"
          onClick={() => onDelete(bookmark.id)}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
