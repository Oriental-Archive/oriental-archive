"use client";

import { useRef, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Status = "idle" | "sending" | "sent" | "error";
type FieldKey =
  | "title"
  | "author"
  | "language"
  | "churchTradition"
  | "sourceLink"
  | "reason"
  | "comments"
  | "requesterName"
  | "requesterContact";

// Max lengths mirror the server's bookRequestSchema (api/book-requests/route.ts)
// — kept here too so a too-long value is caught before a round trip, not just
// after one.
const MAX_LENGTHS: Partial<Record<FieldKey, number>> = {
  title: 500,
  author: 300,
  language: 200,
  churchTradition: 200,
  sourceLink: 2000,
  reason: 5000,
  comments: 5000,
  requesterName: 200,
  requesterContact: 300,
};

// Only the title is required (spec §21: "the important information is the
// identity of the requested book") — everything else just helps a librarian
// track it down.
export function RequestBookForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Partial<Record<FieldKey, React.RefObject<HTMLElement | null>>> = { title: titleRef };

  function flagField(key: FieldKey, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    const el = fieldRefs[key]?.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }

  if (status === "sent") {
    return (
      <Card className="text-sm text-foreground">
        Thank you — your request has been sent to the librarians for review.
      </Card>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const form = e.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
        if (data.title.trim() === "") {
          flagField("title", "Book Title is required — fill in this box before sending.");
          return;
        }

        const body = Object.fromEntries(
          Object.entries(data).filter(([, v]) => typeof v === "string" && v.trim() !== "")
        );
        setStatus("sending");
        try {
          const res = await fetch("/api/book-requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const responseBody = await res.json().catch(() => null);
            const issue = responseBody?.issues?.[0];
            const key = issue?.path?.[0] as FieldKey | undefined;
            if (key && key in MAX_LENGTHS) {
              flagField(key, issue.message);
            } else {
              setError(issue?.message ?? responseBody?.error ?? "Something went wrong — please try again.");
            }
            setStatus("error");
            return;
          }
          setStatus("sent");
        } catch {
          setError("Something went wrong — please try again.");
          setStatus("error");
        }
      }}
    >
      <Field label="Book Title" required error={fieldErrors.title}>
        <Input ref={titleRef} type="text" name="title" maxLength={MAX_LENGTHS.title} />
      </Field>
      <Field label="Author" error={fieldErrors.author}>
        <Input type="text" name="author" maxLength={MAX_LENGTHS.author} />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Language (if known)" error={fieldErrors.language}>
          <Input type="text" name="language" maxLength={MAX_LENGTHS.language} />
        </Field>
        <Field label="Church Tradition (if known)" error={fieldErrors.churchTradition}>
          <Input type="text" name="churchTradition" maxLength={MAX_LENGTHS.churchTradition} />
        </Field>
      </div>
      <Field label="Link or source (if known)" error={fieldErrors.sourceLink}>
        <Input type="text" name="sourceLink" maxLength={MAX_LENGTHS.sourceLink} />
      </Field>
      <Field label="Reason for request" error={fieldErrors.reason}>
        <Textarea name="reason" rows={3} maxLength={MAX_LENGTHS.reason} />
      </Field>
      <Field label="Additional comments" error={fieldErrors.comments}>
        <Textarea name="comments" rows={3} maxLength={MAX_LENGTHS.comments} />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Your name" hint="Optional." error={fieldErrors.requesterName}>
          <Input type="text" name="requesterName" maxLength={MAX_LENGTHS.requesterName} />
        </Field>
        <Field label="Contact info" hint="Optional." error={fieldErrors.requesterContact}>
          <Input type="text" name="requesterContact" maxLength={MAX_LENGTHS.requesterContact} />
        </Field>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={status === "sending"} className="self-start">
        {status === "sending" ? "Sending…" : "Submit request"}
      </Button>
    </form>
  );
}
