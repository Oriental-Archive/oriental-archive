"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Select } from "@/components/ui/Field";

// Shared by "Featured Books" and "Featured Reading Paths" — both are just
// an ordered subset of ids, added/removed/reordered the same way as a
// Reading Path's steps or a Collection's books.
export function FeaturedItemsManager(props: {
  settingsKey: "bookIds" | "readingPathIds";
  label: string;
  selectedIds: string[];
  allItems: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [ids, setIds] = useState(props.selectedIds);
  const [pendingId, setPendingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(props.allItems.map((i) => [i.id, i.title]));
  const candidates = props.allItems.filter((i) => !ids.includes(i.id));

  async function save(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: { [props.settingsKey]: next } }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      setIds(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <p className="text-xs text-muted">{props.label}</p>
      {ids.length === 0 ? (
        <p className="text-sm text-muted">None featured.</p>
      ) : (
        <ul className="divide-y divide-border border-t border-b border-border">
          {ids.map((id, i) => (
            <li key={id} className="flex items-center justify-between gap-2 py-2">
              <span dir="auto" className="text-sm text-foreground">
                {byId.get(id) ?? id}
              </span>
              <div className="flex shrink-0 gap-1 text-xs">
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={busy || i === ids.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  ↓
                </Button>
                <ConfirmButton
                  label="Remove"
                  size="sm"
                  disabled={busy}
                  confirmTitle={`Stop featuring "${byId.get(id) ?? id}"?`}
                  onConfirm={() => save(ids.filter((x) => x !== id))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Select
          value={pendingId}
          onChange={(e) => setPendingId(e.target.value)}
          className="min-w-48"
        >
          <option value="">Select…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          disabled={busy || !pendingId}
          onClick={() => {
            const id = pendingId;
            setPendingId("");
            save([...ids, id]);
          }}
        >
          Add
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
