"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

export function CreateCollectionForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setTitleError(null);
        const entries = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        if (entries.title.trim() === "") {
          setTitleError("Title is required — fill in this box before saving.");
          titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          titleRef.current?.focus();
          return;
        }

        const body = Object.fromEntries(
          Object.entries(entries).filter(([, v]) => typeof v === "string" && v.trim() !== "")
        );
        setBusy(true);
        try {
          const res = await fetch("/api/admin/collections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            const issue = data.issues?.[0];
            if (issue?.path?.[0] === "title") {
              setTitleError(issue.message);
            } else {
              setError(issue?.message ?? data.error ?? "Failed to create.");
            }
            return;
          }
          router.push(`/librarian/collections/${data.id}`);
        } catch {
          // A network drop or a non-JSON error response previously left
          // this silently doing nothing — busy reset by the finally below,
          // but no sign anything went wrong.
          setError("Couldn't reach the server — check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Title" required error={titleError ?? undefined}>
        <Input ref={titleRef} name="title" />
      </Field>
      <Field label="Description" hint="Optional.">
        <Textarea name="description" rows={4} />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={busy} size="md" className="self-start">
        {busy ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}
