import { useMemo, useState } from "react";
import { Highlighter, Download, SlidersHorizontal } from "lucide-react";
import type { Annotation, AnnotationType, HighlightColor } from "@/pdf-reader/types";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";
import { EmptyState } from "@/pdf-reader/components/common/EmptyState";
import { downloadText, exportAnnotations, EXPORT_EXTENSION, EXPORT_MIME, type ExportFormat } from "@/pdf-reader/lib/annotationExport";

type SortMode = "document" | "newest" | "oldest" | "page";

export function AnnotationPanel({
  annotations,
  onNavigate,
  onSelect,
  documentTitle,
}: {
  annotations: Annotation[];
  onNavigate: (page: number) => void;
  onSelect: (a: Annotation) => void;
  documentTitle: string;
}) {
  const [typeFilter, setTypeFilter] = useState<AnnotationType | "all">("all");
  const [colorFilter, setColorFilter] = useState<HighlightColor | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("document");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const allTags = useMemo(() => Array.from(new Set(annotations.flatMap((a) => a.tags))), [annotations]);
  const [tagFilter, setTagFilter] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    let list = annotations;
    if (typeFilter !== "all") list = list.filter((a) => a.type === typeFilter);
    if (colorFilter !== "all") list = list.filter((a) => a.color === colorFilter);
    if (tagFilter !== "all") list = list.filter((a) => a.tags.includes(tagFilter));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => (a.selectedText ?? "").toLowerCase().includes(q) || a.comment.toLowerCase().includes(q));
    }
    const sorted = [...list];
    switch (sort) {
      case "document":
        sorted.sort((a, b) => a.page - b.page);
        break;
      case "page":
        sorted.sort((a, b) => a.page - b.page);
        break;
      case "newest":
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "oldest":
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
    }
    return sorted;
  }, [annotations, typeFilter, colorFilter, tagFilter, query, sort]);

  function handleExport(format: ExportFormat) {
    const content = exportAnnotations(filtered, format, documentTitle);
    downloadText(content, `${documentTitle}-annotations.${EXPORT_EXTENSION[format]}`, EXPORT_MIME[format]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-2.5">
        <div className="flex items-center gap-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter annotations…"
            className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-accent"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-label="Filters"
            className={`flex h-7 w-7 items-center justify-center rounded-md ${filtersOpen ? "bg-accent-subtle text-accent" : "text-text-muted hover:bg-surface-hover"}`}
          >
            <SlidersHorizontal size={14} />
          </button>
          <ExportMenu onExport={handleExport} />
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AnnotationType | "all")} className="rounded-md border border-border bg-transparent px-1.5 py-1">
              <option value="all">All types</option>
              <option value="highlight">Highlight</option>
              <option value="underline">Underline</option>
              <option value="strikethrough">Strikethrough</option>
              <option value="note">Note</option>
              <option value="area">Area</option>
              <option value="drawing">Drawing</option>
            </select>
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value as HighlightColor | "all")} className="rounded-md border border-border bg-transparent px-1.5 py-1">
              <option value="all">All colors</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="purple">Purple</option>
            </select>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="rounded-md border border-border bg-transparent px-1.5 py-1">
              <option value="all">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded-md border border-border bg-transparent px-1.5 py-1">
              <option value="document">Document order</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="page">Page</option>
            </select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Highlighter size={22} strokeWidth={1.5} />}
          title="No annotations yet"
          description="Highlight a passage or add a note while reading. Your annotations will appear here."
        />
      ) : (
        <div className="flex-1 overflow-auto">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onNavigate(a.page);
                onSelect(a);
              }}
              className="group block w-full border-b border-border/60 px-3 py-2 text-left hover:bg-surface-hover"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HIGHLIGHT_COLOR_VARS[a.color] }} />
                <span className="text-[11px] font-medium text-text-muted">p.{a.page}</span>
                <span className="text-[10px] uppercase tracking-wide text-text-muted">{a.type}</span>
              </div>
              {a.selectedText && <p className="mt-1 line-clamp-2 text-[12.5px] text-text-primary">&ldquo;{a.selectedText}&rdquo;</p>}
              {a.comment && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-text-secondary">{a.comment}</p>}
              {a.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {a.tags.map((t) => (
                    <span key={t} className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (format: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const formats: { id: ExportFormat; label: string }[] = [
    { id: "markdown", label: "Markdown" },
    { id: "plaintext", label: "Plain text" },
    { id: "json", label: "JSON" },
    { id: "csv", label: "CSV" },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Export annotations"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover"
      >
        <Download size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-40 mt-1 w-36 rounded-lg border border-border bg-surface-elevated py-1 shadow-md">
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onExport(f.id);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover"
              >
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
