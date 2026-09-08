"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function FileUploadForm(props: {
  action: string;
  accept: string;
  label: string;
  extraFields?: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = new FormData(e.currentTarget).get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      for (const [key, value] of Object.entries(props.extraFields ?? {})) {
        formData.set(key, value);
      }
      const res = await fetch(props.action, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      if (data.duplicateWarning) {
        setResult(
          `Uploaded. Note: this file's checksum matches an existing document (id ${data.duplicateWarning.id}) — it may be a duplicate.`
        );
      } else {
        setResult("Uploaded.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Field label={props.label}>
        <Input type="file" name="file" accept={props.accept} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy} size="sm" className="self-start">
        {busy ? "Uploading…" : "Upload"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {result && <p className="text-xs text-muted">{result}</p>}
    </form>
  );
}
