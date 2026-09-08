"use client";

import {
  listLocalAnnotations,
  createLocalAnnotation,
  updateLocalAnnotation,
  deleteLocalAnnotation,
  type LocalAnnotation,
} from "@/lib/local-annotations";

// One shape, two backends: a signed-in reader's highlights/bookmarks are
// synced through the database (multi-device, spec §10); an anonymous
// reader's live only in this browser's IndexedDB (spec §22). Reader
// components call this facade and never need to know which one is active.
export type AnnotationInput = {
  documentVersionId: string;
  location: unknown;
  selectedText?: string;
  highlightData?: unknown;
  note?: string;
};

export type Annotation = LocalAnnotation;

export function createAnnotationStore(bookId: string, signedIn: boolean) {
  if (signedIn) {
    return {
      // Left to reject on a genuine failure (network throw) rather than
      // resolving to [] — same convention as the local branch's list()
      // below: only the caller can tell "no highlights yet" apart from
      // "couldn't load them", so swallowing the error here would erase
      // that distinction for whoever calls this.
      list: async (documentVersionId?: string): Promise<Annotation[]> => {
        const qs = documentVersionId ? `?versionId=${encodeURIComponent(documentVersionId)}` : "";
        const res = await fetch(`/api/books/${bookId}/annotations${qs}`);
        if (!res.ok) return [];
        return res.json();
      },
      create: async (input: AnnotationInput): Promise<Annotation> => {
        const res = await fetch(`/api/books/${bookId}/annotations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error("Failed to save annotation");
        return res.json();
      },
      // Both report whether the change actually stuck — callers update
      // their UI optimistically and need to know when to undo that instead
      // of letting a failed request masquerade as a successful one. A
      // network-level throw (fetch rejecting outright, not just a non-ok
      // response) must resolve to false too, not reject — an uncaught
      // rejection here would skip the caller's revert-on-failure entirely.
      update: async (id: string, patch: { note?: string; highlightData?: unknown }): Promise<boolean> => {
        try {
          const res = await fetch(`/api/annotations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          return res.ok;
        } catch {
          return false;
        }
      },
      remove: async (id: string): Promise<boolean> => {
        try {
          const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
          return res.ok;
        } catch {
          return false;
        }
      },
    };
  }

  return {
    list: (documentVersionId?: string) => listLocalAnnotations(bookId, documentVersionId),
    create: (input: AnnotationInput) => createLocalAnnotation({ ...input, bookId }),
    // list() above is left to reject on a genuine IndexedDB failure (unlike
    // update/remove below) — callers need to tell "no highlights yet" apart
    // from "couldn't load them", and only the caller has an error UI to say
    // so, so swallowing this here would erase that distinction — this is
    // the one place in this facade where the caller's .catch(), not this
    // one, is the intended handler.
    update: (id: string, patch: { note?: string; highlightData?: unknown }) =>
      updateLocalAnnotation(id, patch).then(() => true).catch(() => false),
    remove: (id: string) => deleteLocalAnnotation(id).then(() => true).catch(() => false),
  };
}
