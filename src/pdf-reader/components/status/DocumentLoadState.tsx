import { useState } from "react";
import { FileWarning, Lock } from "lucide-react";

export function DocumentLoadingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      <p className="text-xs text-text-muted">Opening document…</p>
    </div>
  );
}

export function DocumentErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-center">
      <FileWarning size={32} strokeWidth={1.3} className="text-danger" />
      <div>
        <p className="text-sm font-medium text-text-primary">Couldn&apos;t open this document</p>
        <p className="mt-1 max-w-xs text-xs text-text-muted">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="mt-2 rounded-md border border-border px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover">
        Try again
      </button>
    </div>
  );
}

export function PasswordPrompt({ onSubmit }: { onSubmit: (password: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-background text-center">
      <Lock size={28} strokeWidth={1.3} className="text-text-muted" />
      <p className="text-sm font-medium text-text-primary">This document is password protected</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
        className="flex items-center gap-2"
      >
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter password"
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background">
          Unlock
        </button>
      </form>
    </div>
  );
}
