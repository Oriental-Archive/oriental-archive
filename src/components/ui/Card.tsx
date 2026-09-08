import { cn } from "@/lib/cn";

const paddingClasses = { none: "", sm: "p-2", md: "p-3", lg: "p-4" } as const;

// The surface — a form, a list item, a stat tile — used everywhere an
// admin page needs to set content apart from the page background. Padding
// is a prop rather than left to the caller's className: a className string
// here is a plain concatenation (see lib/cn.ts) with no conflict
// resolution, so two padding utilities in the same string would silently
// leave the winner up to Tailwind's generated stylesheet order rather than
// the last one written — going through one `padding` prop makes that
// class of bug impossible instead of relying on every caller to avoid it.
//
// Renders as a <div> by default; pass as="li" for the many manager lists
// (Reading Path steps, Collection books, Footer churches, Featured items)
// whose entries must stay valid <li> children of a <ul>, or as="form" for
// the small add-item forms those same managers pair it with.
export function Card({
  as: Tag = "div",
  padding = "lg",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "li" | "form"; padding?: keyof typeof paddingClasses }) {
  return (
    <Tag className={cn("rounded-sm border border-border bg-surface", paddingClasses[padding], className)} {...props} />
  );
}
