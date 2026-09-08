import Link from "next/link";
import { cn } from "@/lib/cn";

// Replaces five byte-identical local TabLink/StatusTab components (Books,
// Book Requests, Reading Paths, Collections, Issue Reports list pages) —
// each was its own copy of the same filter-pill row, one already updated
// for mobile (flex-wrap) and the other four not.
export function StatusTabs(props: { tabs: { label: string; href: string; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {props.tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "rounded-full border px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            t.active ? "border-navy bg-navy text-background" : "border-border text-muted hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
