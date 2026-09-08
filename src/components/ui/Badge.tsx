import { cn } from "@/lib/cn";

export type BadgeVariant = "outline" | "gold" | "solid" | "featured";

const variantClasses: Record<BadgeVariant, string> = {
  outline: "rounded-full border border-border px-3 py-1 text-xs text-foreground",
  gold: "rounded-full border border-gold px-2.5 py-0.5 text-xs text-navy",
  solid: "rounded-full border border-navy bg-navy px-3 py-1 text-xs text-background",
  // Was bare uppercase text with no chip shape at all — given a real
  // outline here so "Featured" reads as a status the same way every other
  // badge does, while staying in the same burgundy the rest of the app
  // already uses for emphasis.
  featured: "rounded-full border border-burgundy px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-burgundy uppercase",
};

export function Badge({
  variant = "outline",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn(variantClasses[variant], className)} {...props} />;
}
