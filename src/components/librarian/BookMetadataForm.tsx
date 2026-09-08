"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

export type TermOption = { id: string; label: string };

export type BookMetadataValues = {
  title: string;
  alternateTitle: string;
  originalTitle: string;
  author: string;
  translator: string;
  editor: string;
  publisher: string;
  publicationYear: string;
  description: string;
  pageCount: string;
  provenance: string;
  scriptureReferences: string;
  languageId: string;
  churchTraditionId: string;
  documentTypeId: string;
  categoryId: string;
  rightsStatusId: string;
  topicIds: string[];
  churchFatherIds: string[];
};

export const EMPTY_BOOK_VALUES: BookMetadataValues = {
  title: "",
  alternateTitle: "",
  originalTitle: "",
  author: "",
  translator: "",
  editor: "",
  publisher: "",
  publicationYear: "",
  description: "",
  pageCount: "",
  provenance: "",
  scriptureReferences: "",
  languageId: "",
  churchTraditionId: "",
  documentTypeId: "",
  categoryId: "",
  rightsStatusId: "",
  topicIds: [],
  churchFatherIds: [],
};

// Fields that must be filled before this form will submit — kept as one
// ordered list so both the asterisks and the "jump to the missing box"
// validation below read from the same source of truth instead of drifting
// apart. Order matches the form's visual top-to-bottom order, so validation
// always lands on the *first* empty required field.
const REQUIRED_FIELDS: { key: keyof BookMetadataValues; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "languageId", label: "Language" },
  { key: "churchTraditionId", label: "Church Tradition" },
  { key: "documentTypeId", label: "Document Type" },
  { key: "pageCount", label: "Page Count" },
];

function isBlank(values: BookMetadataValues, key: keyof BookMetadataValues): boolean {
  const v = values[key];
  return typeof v === "string" ? v.trim() === "" : v.length === 0;
}

// Shared between "Add Book" (POSTs to /api/admin/books) and the book edit
// page (PATCHes /api/admin/books/[id]) — the metadata fields and their
// validation quirks (numbers as numbers, comma-separated scripture refs,
// multi-select vocab) are identical either way.
export function BookMetadataForm(props: {
  mode: "create" | "edit";
  bookId?: string;
  initial: BookMetadataValues;
  languages: TermOption[];
  traditions: TermOption[];
  documentTypes: TermOption[];
  categories: TermOption[];
  rightsStatuses: TermOption[];
  topics: TermOption[];
  churchFathers: TermOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BookMetadataValues, string>>>({});
  // Create mode only — there's no book id to attach a file to until after
  // this form's POST succeeds, so these are held here and uploaded
  // immediately afterward rather than being part of the JSON body.
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [bookIdForRetry, setBookIdForRetry] = useState<string | null>(null);

  // One stable ref per required field (not a generic callback-ref map built
  // during render — react-hooks/refs flags reading `.current` from a ref
  // callback created fresh each render as unsafe).
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const languageRef = useRef<HTMLSelectElement>(null);
  const traditionRef = useRef<HTMLSelectElement>(null);
  const documentTypeRef = useRef<HTMLSelectElement>(null);
  const pageCountRef = useRef<HTMLInputElement>(null);
  const requiredFieldRefs: Partial<Record<keyof BookMetadataValues, React.RefObject<HTMLElement | null>>> = {
    title: titleRef,
    description: descriptionRef,
    languageId: languageRef,
    churchTraditionId: traditionRef,
    documentTypeId: documentTypeRef,
    pageCount: pageCountRef,
  };

  function set<K extends keyof BookMetadataValues>(key: K, value: BookMetadataValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Points at the exact box that needs filling in, rather than a generic
  // "fix the form" banner — scrolls it into view, focuses it, and puts a red
  // message directly under that one field.
  function flagField(key: keyof BookMetadataValues, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    const el = requiredFieldRefs[key]?.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }

  function validate(): boolean {
    for (const field of REQUIRED_FIELDS) {
      if (isBlank(values, field.key)) {
        flagField(field.key, `${field.label} is required — fill in this box before saving.`);
        return false;
      }
    }
    if (Number(values.pageCount) <= 0) {
      flagField("pageCount", "Page Count must be a positive number.");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      const body = {
        title: values.title,
        alternateTitle: values.alternateTitle || undefined,
        originalTitle: values.originalTitle || undefined,
        author: values.author || undefined,
        translator: values.translator || undefined,
        editor: values.editor || undefined,
        publisher: values.publisher || undefined,
        publicationYear: values.publicationYear ? Number(values.publicationYear) : undefined,
        description: values.description,
        pageCount: Number(values.pageCount),
        provenance: values.provenance || undefined,
        scriptureReferences: values.scriptureReferences
          ? values.scriptureReferences.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        languageId: values.languageId,
        churchTraditionId: values.churchTraditionId,
        documentTypeId: values.documentTypeId,
        categoryId: values.categoryId || undefined,
        rightsStatusId: values.rightsStatusId || undefined,
        topicIds: values.topicIds,
        churchFatherIds: values.churchFatherIds,
      };

      const res = await fetch(
        props.mode === "create" ? "/api/admin/books" : `/api/admin/books/${props.bookId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        // A Zod issue path maps 1:1 onto a BookMetadataValues key (both are
        // named after the same field) — so a server-side validation failure
        // can point at the same box a client-side one would.
        const issue = data.issues?.[0];
        const key = issue?.path?.[0] as keyof BookMetadataValues | undefined;
        if (key && key in EMPTY_BOOK_VALUES) {
          flagField(key, issue.message);
        } else {
          setError(issue?.message ?? data.error ?? "Failed to save.");
        }
        return;
      }
      if (props.mode === "create") {
        const failures: string[] = [];
        if (coverFile) {
          const ok = await uploadFile(`/api/admin/books/${data.id}/cover`, coverFile);
          if (!ok) failures.push("cover image");
        }
        if (documentFile) {
          const ok = await uploadFile(`/api/admin/books/${data.id}/versions`, documentFile, { setActive: "true" });
          if (!ok) failures.push("document file");
        }
        if (failures.length > 0) {
          // Stay put instead of navigating away — the failure message would
          // never be seen if this component navigated out from under it.
          setUploadWarning(
            `Book saved, but the ${failures.join(" and ")} failed to upload — add ${failures.length > 1 ? "them" : "it"} from the book's page instead.`
          );
          setBookIdForRetry(data.id);
          return;
        }
        router.push(`/librarian/books/${data.id}`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(url: string, file: File, extraFields?: Record<string, string>): Promise<boolean> {
    const formData = new FormData();
    formData.set("file", file);
    for (const [key, value] of Object.entries(extraFields ?? {})) formData.set(key, value);
    const res = await fetch(url, { method: "POST", body: formData });
    return res.ok;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {props.mode === "create" && (
        <div className="flex flex-col gap-4 border border-border bg-surface p-4">
          <p className="text-xs text-muted">
            Files are optional here — you can always add or replace them later from the book&apos;s
            page.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cover Image" hint="Optional. JPEG, PNG, or WebP.">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                className="text-sm text-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
              />
            </Field>
            <Field label="Document File" hint="Optional. PDF, EPUB, or DOCX.">
              <input
                type="file"
                accept=".pdf,.epub,.docx"
                onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                className="text-sm text-foreground file:mr-3 file:rounded-sm file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs"
              />
            </Field>
          </div>
        </div>
      )}

      <Field label="Title" required error={fieldErrors.title}>
        <Input ref={titleRef} value={values.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Alternate Title">
          <Input value={values.alternateTitle} onChange={(e) => set("alternateTitle", e.target.value)} />
        </Field>
        <Field label="Original Title">
          <Input value={values.originalTitle} onChange={(e) => set("originalTitle", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Author">
          <Input value={values.author} onChange={(e) => set("author", e.target.value)} />
        </Field>
        <Field label="Translator">
          <Input value={values.translator} onChange={(e) => set("translator", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Editor">
          <Input value={values.editor} onChange={(e) => set("editor", e.target.value)} />
        </Field>
        <Field label="Publisher">
          <Input value={values.publisher} onChange={(e) => set("publisher", e.target.value)} />
        </Field>
        <Field label="Publication Year">
          <Input type="number" value={values.publicationYear} onChange={(e) => set("publicationYear", e.target.value)} />
        </Field>
      </div>

      <Field label="Description" required error={fieldErrors.description}>
        <Textarea
          ref={descriptionRef}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Language" required error={fieldErrors.languageId}>
          <Select ref={languageRef} value={values.languageId} onChange={(e) => set("languageId", e.target.value)}>
            <option value="" disabled hidden>
              Select a language…
            </option>
            {props.languages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Church Tradition" required error={fieldErrors.churchTraditionId}>
          <Select
            ref={traditionRef}
            value={values.churchTraditionId}
            onChange={(e) => set("churchTraditionId", e.target.value)}
          >
            <option value="" disabled hidden>
              Select a tradition…
            </option>
            {props.traditions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Document Type" required error={fieldErrors.documentTypeId}>
          <Select
            ref={documentTypeRef}
            value={values.documentTypeId}
            onChange={(e) => set("documentTypeId", e.target.value)}
          >
            <option value="" disabled hidden>
              Select a type…
            </option>
            {props.documentTypes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" hint="Optional.">
          <Select value={values.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">None / any</option>
            {props.categories.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Rights Status" hint="Optional.">
          <Select value={values.rightsStatusId} onChange={(e) => set("rightsStatusId", e.target.value)}>
            <option value="">None / any</option>
            {props.rightsStatuses.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Topics" hint="Optional — select only topics that actually apply to this book.">
          <Select
            multiple
            value={values.topicIds}
            onChange={(e) => set("topicIds", Array.from(e.target.selectedOptions, (o) => o.value))}
            className="h-24"
          >
            {props.topics.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Church Fathers / Saints" hint="Optional — select only if this book is by or about one.">
          <Select
            multiple
            value={values.churchFatherIds}
            onChange={(e) => set("churchFatherIds", Array.from(e.target.selectedOptions, (o) => o.value))}
            className="h-24"
          >
            {props.churchFathers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Scripture References (comma-separated)" hint="Optional.">
        <Input value={values.scriptureReferences} onChange={(e) => set("scriptureReferences", e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Page Count" required error={fieldErrors.pageCount}>
          <Input
            ref={pageCountRef}
            type="number"
            min={1}
            value={values.pageCount}
            onChange={(e) => set("pageCount", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Provenance" hint="Optional.">
        <Textarea value={values.provenance} onChange={(e) => set("provenance", e.target.value)} rows={4} />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}
      {uploadWarning && bookIdForRetry && (
        <p className="text-sm text-danger">
          {uploadWarning}{" "}
          <Link href={`/librarian/books/${bookIdForRetry}`} className="underline">
            Go to the book
          </Link>
        </p>
      )}

      <Button type="submit" disabled={busy} size="md" className="self-start">
        {busy ? "Saving…" : props.mode === "create" ? "Create Book" : "Save Changes"}
      </Button>
    </form>
  );
}
