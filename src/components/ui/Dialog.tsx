"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

// Built on the native <dialog> element rather than a portal+overlay
// component — it gets modal focus-trapping, Escape-to-close, and
// ::backdrop for free from the browser, so nothing else needs adding for
// this app's one use of a dialog (confirming a destructive action; see
// ConfirmButton.tsx).
export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (props.open && !el.open) el.showModal();
    if (!props.open && el.open) el.close();
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      onCancel={props.onClose}
      onClick={(e) => {
        // A click that lands on the <dialog> element itself (not anything
        // inside it) is a click on the ::backdrop area.
        if (e.target === e.currentTarget) props.onClose();
      }}
      className={cn(
        "w-[calc(100%-2rem)] max-w-sm rounded-sm border border-border bg-surface p-6 text-foreground",
        props.className
      )}
    >
      <h2 className="font-serif text-lg text-foreground">{props.title}</h2>
      <div className="mt-3">{props.children}</div>
    </dialog>
  );
}
