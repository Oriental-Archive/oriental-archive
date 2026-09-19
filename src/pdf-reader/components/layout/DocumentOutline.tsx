import { useMemo, useState } from "react";
import { ChevronRight, ListTree } from "lucide-react";
import type { OutlineNode } from "@/pdf-reader/types";
import { EmptyState } from "@/pdf-reader/components/common/EmptyState";

type FlatNode = { node: OutlineNode; key: string; depth: number };

function flatten(nodes: OutlineNode[], depth = 0, prefix = ""): FlatNode[] {
  return nodes.flatMap((node, i) => {
    const key = `${prefix}${i}`;
    return [{ node, key, depth }, ...flatten(node.children, depth + 1, `${key}-`)];
  });
}

export function DocumentOutline({
  outline,
  currentPage,
  onNavigate,
}: {
  outline: OutlineNode[];
  currentPage: number;
  onNavigate: (page: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const flat = useMemo(() => flatten(outline), [outline]);
  const activeKey = useMemo(() => {
    let best: string | null = null;
    let bestPage = -1;
    for (const f of flat) {
      if (f.node.page !== null && f.node.page <= currentPage && f.node.page > bestPage) {
        best = f.key;
        bestPage = f.node.page;
      }
    }
    return best;
  }, [flat, currentPage]);

  if (outline.length === 0) {
    return (
      <EmptyState
        icon={<ListTree size={22} strokeWidth={1.5} />}
        title="No table of contents"
        description="This document does not contain an embedded table of contents."
      />
    );
  }

  const visible = flat.filter((f) => {
    // hidden if any ancestor prefix is collapsed
    const parts = f.key.split("-");
    for (let i = 1; i < parts.length; i++) {
      if (collapsed.has(parts.slice(0, i).join("-"))) return false;
    }
    return true;
  });

  return (
    <div className="h-full overflow-auto py-2">
      {visible.map((f) => {
        const hasChildren = f.node.children.length > 0;
        const isCollapsed = collapsed.has(f.key);
        return (
          <div key={f.key} className="flex items-center">
            <button
              type="button"
              onClick={() => {
                if (!hasChildren) return;
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(f.key)) next.delete(f.key);
                  else next.add(f.key);
                  return next;
                });
              }}
              aria-label={hasChildren ? (isCollapsed ? "Expand section" : "Collapse section") : undefined}
              className="flex h-6 w-5 shrink-0 items-center justify-center text-text-muted"
              style={{ marginLeft: f.depth * 14 }}
            >
              {hasChildren && (
                <ChevronRight size={12} className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
              )}
            </button>
            <button
              type="button"
              disabled={f.node.page === null}
              onClick={() => f.node.page !== null && onNavigate(f.node.page)}
              className={`flex-1 truncate py-1 pr-3 text-left text-[13px] leading-snug disabled:text-text-muted disabled:opacity-60 ${
                activeKey === f.key ? "font-medium text-accent" : "text-text-secondary hover:text-text-primary"
              }`}
              title={f.node.title}
            >
              {f.node.title}
            </button>
          </div>
        );
      })}
    </div>
  );
}
