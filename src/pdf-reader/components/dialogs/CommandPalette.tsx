import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { shortcutKeyLabel } from "@/pdf-reader/lib/shortcuts";

export type Command = { id: string; label: string; shortcut?: string; run: () => void };

export function CommandPalette({
  commands,
  onClose,
  onGoToPage,
}: {
  commands: Command[];
  onClose: () => void;
  onGoToPage: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const pageMatch = query.trim().match(/^\d+$/);
  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query]
  );
  const items = pageMatch
    ? [{ id: "goto", label: `Go to page ${pageMatch[0]}`, run: () => onGoToPage(Number(pageMatch[0])) }, ...filtered]
    : filtered;

  function run(i: number) {
    items[i]?.run();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[8vh] sm:pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[min(480px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-lg"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search size={15} className="text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(index);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Type a command or page number…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {items.length === 0 && <p className="px-3 py-4 text-center text-xs text-text-muted">No matching commands.</p>}
          {items.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] ${
                i === index ? "bg-accent-subtle text-accent" : "text-text-secondary"
              }`}
            >
              {c.label}
              {"shortcut" in c && c.shortcut && (
                <kbd className="font-mono text-[11px] text-text-muted">{shortcutKeyLabel(c.shortcut)}</kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
