import { forwardRef } from "react";
import { Tooltip } from "@/pdf-reader/components/common/Tooltip";

type Props = {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  onClick?: () => void;
  children: React.ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, shortcut, active, disabled, size = "md", onClick, children },
  ref
) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex ${dim} items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 ${
        active
          ? "bg-accent-subtle text-accent"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
  return (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
});
