"use client";

import { useState } from "react";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const REASONS: { value: string; label: string }[] = [
  { value: "COPYRIGHT", label: "Copyright concern" },
  { value: "INCORRECT_ATTRIBUTION", label: "Incorrect attribution" },
  { value: "INCORRECT_METADATA", label: "Incorrect metadata" },
  { value: "BROKEN_FILE", label: "Broken file" },
  { value: "POOR_SCAN", label: "Poor scan" },
  { value: "MISSING_PAGES", label: "Missing pages" },
  { value: "THEOLOGICAL_CATEGORIZATION", label: "Theological categorization issue" },
  { value: "OTHER", label: "Other problem" },
];

// A report only ever lands in the librarian queue (spec §25) — this form has
// no path to change the book itself, by design.
export function ReportIssueForm({ bookId }: { bookId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!open) {
    return (
      <Button variant="ghost" size="inline" onClick={() => setOpen(true)} className="text-sm underline">
        Report an issue
      </Button>
    );
  }

  if (status === "sent") {
    return <p className="text-sm text-muted">Thank you — this has been sent to the librarians for review.</p>;
  }

  return (
    <Card
      as="form"
      className="flex max-w-md flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus("sending");
        try {
          const res = await fetch(`/api/books/${bookId}/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, details: details || undefined }),
          });
          setStatus(res.ok ? "sent" : "error");
        } catch {
          setStatus("error");
        }
      }}
    >
      <p className="font-serif text-sm text-foreground">Report an issue</p>
      <Field label="Reason">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Details (optional)">
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
      </Field>
      {status === "error" && (
        <p className="text-xs text-danger">Something went wrong — please try again.</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Submit"}
        </Button>
        <Button variant="ghost" size="inline" type="button" onClick={() => setOpen(false)} className="text-sm">
          Cancel
        </Button>
      </div>
    </Card>
  );
}
