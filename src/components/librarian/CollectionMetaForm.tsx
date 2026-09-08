"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

export function CollectionMetaForm(props: {
  collectionId: string;
  initialTitle: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTitleError(null);
    if (title.trim() === "") {
      setTitleError("Title is required — fill in this box before saving.");
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/collections/${props.collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save.");
        return;
      }
      router.refresh();
    } catch {
      // A network drop or a non-JSON error response previously left this
      // silently doing nothing — busy reset by the finally below, but no
      // sign anything went wrong.
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field label="Title" required error={titleError ?? undefined}>
        <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description" hint="Optional.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy} size="md" className="self-start">
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
