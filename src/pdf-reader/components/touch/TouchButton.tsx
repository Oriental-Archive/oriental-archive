/** A 44×44 minimum tap target — the smallest a thumb can hit reliably without looking. */
export function TouchButton({
  label,
  onClick,
  active,
  disabled,
  children,
  className = "",
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-surface-hover disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-accent ${
        active ? "text-accent" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Icon over a small label — used where the meaning shouldn't depend on guessing an icon. */
export function BarButton({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] leading-none transition-colors active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${
        active ? "text-accent" : "text-text-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
