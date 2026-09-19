import { useState } from "react";
import { Search, ChevronUp, ChevronDown, CaseSensitive, WholeWord, AlertTriangle } from "lucide-react";
import type { SearchMatch, SearchOptions } from "@/pdf-reader/hooks/usePdfSearch";
import { EmptyState } from "@/pdf-reader/components/common/EmptyState";

export function DocumentSearch({
  query,
  options,
  onOptionsChange,
  matches,
  activeIndex,
  onActiveIndexChange,
  searching,
  noTextLayer,
  onSearch,
  onNavigate,
}: {
  query: string;
  options: SearchOptions;
  onOptionsChange: (o: SearchOptions) => void;
  matches: SearchMatch[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  searching: boolean;
  noTextLayer: boolean;
  onSearch: (query: string) => void;
  onNavigate: (page: number) => void;
}) {
  const [draft, setDraft] = useState(query);

  function submit() {
    onSearch(draft);
  }

  function step(delta: number) {
    if (matches.length === 0) return;
    const next = (activeIndex + delta + matches.length) % matches.length;
    onActiveIndexChange(next);
    onNavigate(matches[next].page);
  }

  const grouped = new Map<number, { match: SearchMatch; index: number }[]>();
  matches.forEach((m, i) => {
    const list = grouped.get(m.page) ?? [];
    list.push({ match: m, index: i });
    grouped.set(m.page, list);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-border p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-1"
        >
          <div className="relative flex-1">
            <Search size={13} className="absolute top-1/2 left-2 -translate-y-1/2 text-text-muted" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search document…"
              className="w-full rounded-md border border-border bg-transparent py-1.5 pr-2 pl-7 text-xs focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>
        </form>
        <div className="flex items-center gap-1">
          <ToggleChip
            label="Case-sensitive"
            active={options.caseSensitive}
            onClick={() => onOptionsChange({ ...options, caseSensitive: !options.caseSensitive })}
          >
            <CaseSensitive size={13} />
          </ToggleChip>
          <ToggleChip
            label="Whole word"
            active={options.wholeWord}
            onClick={() => onOptionsChange({ ...options, wholeWord: !options.wholeWord })}
          >
            <WholeWord size={13} />
          </ToggleChip>

          <div className="ml-auto flex items-center gap-1 text-[11px] text-text-muted">
            {searching ? "Searching…" : query && `${matches.length} result${matches.length === 1 ? "" : "s"}`}
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={matches.length === 0}
              aria-label="Previous match"
              className="rounded p-0.5 hover:bg-surface-hover disabled:opacity-30"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={matches.length === 0}
              aria-label="Next match"
              className="rounded p-0.5 hover:bg-surface-hover disabled:opacity-30"
            >
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
      </div>

      {noTextLayer && (
        <div className="m-2 flex items-start gap-2 rounded-md bg-warning/10 p-2 text-[11px] text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          No searchable text found — this document may be a scanned image without a text layer.
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {!query ? (
          <EmptyState
            icon={<Search size={22} strokeWidth={1.5} />}
            title="Search this document"
            description="Find exact matches across every page, with results grouped by page."
          />
        ) : matches.length === 0 && !searching ? (
          <EmptyState icon={<Search size={22} strokeWidth={1.5} />} title="No matches" description={`Nothing found for "${query}".`} />
        ) : (
          Array.from(grouped.entries()).map(([page, items]) => (
            <div key={page}>
              <div className="sticky top-0 bg-background-secondary px-3 py-1 text-[11px] font-medium text-text-muted">
                Page {page} · {items.length} match{items.length === 1 ? "" : "es"}
              </div>
              {items.map(({ match, index }) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    onActiveIndexChange(index);
                    onNavigate(match.page);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[12px] leading-snug ${
                    index === activeIndex ? "bg-accent-subtle text-text-primary" : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  …{match.context}…
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ToggleChip({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md ${
        active ? "bg-accent-subtle text-accent" : "text-text-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}
