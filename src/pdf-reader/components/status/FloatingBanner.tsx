export function FloatingBanner({
  message,
  actionLabel,
  onAction,
  onDismiss,
  style,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  /** Lets a caller lift it above bars/safe areas (the phone reader does). */
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="status"
      data-no-gesture=""
      style={style}
      className="pointer-events-auto absolute bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-[12.5px] shadow-md transition-[bottom] duration-200 sm:w-auto"
    >
      <span className="min-w-0 flex-1 truncate text-text-secondary">{message}</span>
      <button type="button" onClick={onAction} className="min-h-9 px-1 font-medium text-accent">
        {actionLabel}
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="flex h-9 w-7 items-center justify-center text-text-muted">
        ×
      </button>
    </div>
  );
}
