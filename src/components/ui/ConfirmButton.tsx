"use client";

import { useState } from "react";
import { Button, type ButtonVariant, type ButtonSize } from "./Button";
import { Dialog } from "./Dialog";

// The one way a destructive or sensitive action gets wired up anywhere in
// the app — a bare button that fires a delete/disable/remove straight from
// its onClick is exactly the pattern this replaces (it previously had no
// exceptions: every "Remove" button in every manager component, and the
// account "Active" checkbox, mutated on click/change with no confirmation
// step at all). Reaching for this is strictly less code than hand-rolling
// the fetch-on-click it replaces, so it's the path of least resistance for
// new destructive actions too.
export function ConfirmButton(props: {
  label: React.ReactNode;
  confirmTitle: string;
  confirmDescription?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await props.onConfirm();
      setOpen(false);
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={props.variant ?? "destructive"}
        size={props.size}
        disabled={props.disabled}
        className={props.className}
        onClick={() => setOpen(true)}
      >
        {props.label}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title={props.confirmTitle}>
        {props.confirmDescription && <p className="text-sm text-muted">{props.confirmDescription}</p>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={confirm} disabled={busy}>
            {busy ? "Working…" : (props.confirmLabel ?? props.label)}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
