"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Select } from "@/components/ui/Field";

export function AccountManageForm(props: {
  accountId: string;
  initialRole: "STANDARD" | "LIBRARIAN";
  initialActive: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(props.initialRole);
  const [isActive, setIsActive] = useState(props.initialActive);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both callers set role/isActive optimistically before this resolves —
  // on any failure (a clean non-ok response, not just a network drop) that
  // optimistic value must be put back, or the UI keeps showing a role/active
  // state the server never actually saved.
  async function patch(body: Record<string, unknown>, revert: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${props.accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Update failed.");
        revert();
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      revert();
    } finally {
      setBusy(false);
    }
  }

  // Re-enabling is a normal, reversible toggle and applies immediately.
  // Disabling immediately signs the account out everywhere and blocks
  // sign-in — sensitive enough that it shouldn't fire from a bare checkbox
  // click, so it routes through a confirm step instead (ConfirmButton
  // doesn't fit here since the trigger is a checkbox, not a button).
  function handleActiveChange(checked: boolean) {
    if (checked) {
      setIsActive(true);
      patch({ isActive: true }, () => setIsActive(false));
    } else {
      setConfirmingDisable(true);
    }
  }

  async function confirmDisable() {
    setIsActive(false);
    await patch({ isActive: false }, () => setIsActive(true));
    setConfirmingDisable(false);
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Account Type">
        <Select
          value={role}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value as "STANDARD" | "LIBRARIAN";
            const previous = role;
            setRole(next);
            patch({ role: next }, () => setRole(previous));
          }}
        >
          <option value="STANDARD">Standard Account</option>
          <option value="LIBRARIAN">Librarian</option>
        </Select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={isActive}
          disabled={busy}
          onChange={(e) => handleActiveChange(e.target.checked)}
          className="accent-navy"
        />
        Active (unchecking disables sign-in and revokes existing sessions)
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Dialog
        open={confirmingDisable}
        onClose={() => !busy && setConfirmingDisable(false)}
        title="Disable this account?"
      >
        <p className="text-sm text-muted">
          This immediately signs the account out everywhere and blocks sign-in until it&apos;s
          re-enabled.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmingDisable(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={confirmDisable}>
            {busy ? "Working…" : "Disable"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
