// Hand-rolled rather than pulling in clsx/tailwind-merge — every className
// list in this codebase is a short, static set of variant strings (see
// components/ui), so there's never a need to dedupe conflicting utilities,
// just to join the ones that apply.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
