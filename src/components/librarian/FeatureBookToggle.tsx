"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

// Adds/removes this book from the homepage featured list. Re-reads the list
// right before saving so it never overwrites a change made elsewhere (e.g.
// another book's toggle, or the reorder list in Site Settings).
export function FeatureBookToggle(props: { bookId: string; initialFeatured: boolean; isPublic: boolean }) {
  const router = useRouter();
  const [featured, setFeatured] = useState(props.initialFeatured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const current = await fetch("/api/admin/site-settings").then((r) => r.json());
      const ids: string[] = current.featured?.bookIds ?? [];
      const next = featured ? ids.filter((id) => id !== props.bookId) : [...ids.filter((id) => id !== props.bookId), props.bookId];
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: { bookIds: next } }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? data.issues?.[0]?.message ?? "Failed to save.");
        return;
      }
      setFeatured(!featured);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button size="sm" variant={featured ? "secondary" : "primary"} disabled={busy} onClick={toggle}>
          {featured ? "Remove from homepage" : "Feature on homepage"}
        </Button>
        <span className="text-xs text-muted">
          {featured ? "Featured." : "Not featured."}{" "}
          <Link href="/librarian/site-settings#featured-books" className="underline hover:text-burgundy">
            Reorder featured books
          </Link>
        </span>
      </div>
      {featured && !props.isPublic && (
        <p className="text-xs text-danger">Only Public books appear on the homepage — make this book Public to show it.</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
