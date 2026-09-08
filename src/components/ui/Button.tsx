import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "toolbar";
export type ButtonSize = "sm" | "md" | "icon" | "inline" | "xs";

// The one place every clickable action in the app gets its look and its
// interactive states (hover/focus/disabled) from — no page or component
// hand-rolls its own button classes. `buttonVariants` is exported
// separately so a styled-as-a-button <Link> (navigation, "+ New", "View
// public page") can share the exact same classes as a real <button>
// without the two ever drifting apart.
const base =
  "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-burgundy",
  secondary: "border border-navy text-navy hover:border-burgundy hover:text-burgundy",
  destructive: "bg-danger text-danger-foreground hover:bg-navy",
  ghost: "text-foreground hover:text-burgundy",
  // The reader's dark toolbar chrome (page/zoom/search controls) — sits on
  // a navy bar, not the page background, so it needs its own border/hover
  // treatment and a focus-ring offset that matches that dark background
  // instead of the light page one every other variant assumes.
  toolbar: "border border-white/20 hover:border-gold focus-visible:ring-offset-navy",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  icon: "h-8 w-8 p-0 text-sm",
  // For a ghost link/button that should read as plain text (nav items, "←
  // Back", inline "Remove") — no padding to preserve, so it drops into
  // running text or a gap-* flex row exactly like a bare <Link> would.
  inline: "",
  xs: "px-2 py-1 text-xs",
};

export function buttonVariants(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const variant = opts.variant ?? "primary";
  const defaultSize = variant === "ghost" ? "inline" : variant === "toolbar" ? "xs" : "md";
  const size = opts.size ?? defaultSize;
  return cn(base, variantClasses[variant], sizeClasses[size], opts.className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonVariants({ variant, size, className })} {...props} />;
});
