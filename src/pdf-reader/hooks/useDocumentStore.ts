import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  documentReducer,
  emptyDocumentData,
  loadDocumentData,
  saveDocumentData,
  type DocumentData,
} from "@/pdf-reader/lib/documentStore";
import {
  annotationToRecord,
  bookmarkToRecord,
  markSynced,
  planSync,
  recordToAnnotation,
  recordToBookmark,
  syncedStateOf,
  updatePatch,
  type RecordStore,
  type SyncedState,
} from "@/pdf-reader/lib/siteRecords";
import type { CitationFields, SaveStatus } from "@/pdf-reader/types";

const LOCAL_SAVE_MS = 300;
const SYNC_DEBOUNCE_MS = 500;
const RETRY_BASE_MS = 2000;
const MAX_RETRIES = 4;

/**
 * One document's reader state, in two homes:
 *  - annotations and bookmarks live in the site's annotation store
 *    (`remote`: the database when signed in, this browser's IndexedDB
 *    otherwise), so they follow the reader and show up everywhere else on the
 *    site;
 *  - research notes, saved citations and reading position have no server
 *    model yet, so they stay in this browser's localStorage.
 *
 * Edits apply to local state instantly; a background reconciler then makes the
 * store match. It works from "what does the store hold vs what should it
 * hold" rather than replaying individual edits, which is what makes undo/redo
 * (whole-array swaps) and retrying after a failure both come out right.
 */
export function useDocumentStore(documentId: string | null, remote: RecordStore | null, citationDefaults?: Partial<CitationFields>) {
  const [data, dispatch] = useReducer(documentReducer, undefined, emptyDocumentData);
  const [localStatus, setLocalStatus] = useState<SaveStatus>("idle");
  const [syncStatus, setSyncStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  // True once this document's saved data is in `data` (same render), so callers can restore state from it without racing the load.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const loadedIdRef = useRef<string | null>(null);
  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest values for the async reconciler, which outlives any one render.
  const dataRef = useRef(data);
  dataRef.current = data;
  const remoteRef = useRef(remote);
  remoteRef.current = remote;
  const defaultsRef = useRef(citationDefaults);
  defaultsRef.current = citationDefaults;

  const syncedRef = useRef<SyncedState>(new Map());
  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!documentId) {
      loadedIdRef.current = null;
      setLoadedId(null);
      return;
    }
    let cancelled = false;
    const local = loadDocumentData(documentId, defaultsRef.current);
    setLocalStatus("idle");
    setSyncStatus("idle");
    setLoadError(null);
    syncedRef.current = new Map();
    retriesRef.current = 0;

    void (async () => {
      let { annotations, bookmarks } = local;
      const store = remoteRef.current;
      if (store) {
        annotations = [];
        bookmarks = [];
        try {
          const records = await store.list();
          annotations = records.flatMap((r) => recordToAnnotation(r, documentId) ?? []);
          bookmarks = records.flatMap((r) => recordToBookmark(r, documentId) ?? []);
          // Seeded from the reader's own view of each row (not the raw row) so
          // normalizing legacy data on load doesn't look like an edit to sync back.
          syncedRef.current = syncedStateOf([...annotations.map(annotationToRecord), ...bookmarks.map(bookmarkToRecord)]);
        } catch {
          // Left empty rather than blocking the reader — and because nothing
          // was loaded, nothing is in the synced set, so nothing can be
          // "deleted" from the store as a side effect of not having seen it.
          setLoadError("Couldn't load your saved highlights and bookmarks for this book.");
        }
      }
      if (cancelled) return;
      dispatch({ type: "replace", data: { ...local, annotations, bookmarks } });
      loadedIdRef.current = documentId;
      setLoadedId(documentId);
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // ---- local persistence (notes, citations, reading position) --------------
  useEffect(() => {
    if (!documentId || loadedIdRef.current !== documentId) return;
    setLocalStatus("saving");
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(() => {
      try {
        // Annotations and bookmarks belong to the store; a second copy here would only go stale.
        saveDocumentData(documentId, remoteRef.current ? { ...data, annotations: [], bookmarks: [] } : data);
        setLocalStatus("saved");
      } catch {
        setLocalStatus("error");
      }
    }, LOCAL_SAVE_MS);
    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
    };
  }, [data, documentId]);

  // The debounce above is cancelled when the reader unmounts, so a note typed
  // just before "Back to book" would be lost — write once more on the way out.
  useEffect(
    () => () => {
      const id = loadedIdRef.current;
      if (!id) return;
      try {
        const latest = dataRef.current;
        saveDocumentData(id, remoteRef.current ? { ...latest, annotations: [], bookmarks: [] } : latest);
      } catch {
        // Nothing left to tell anyone: the reader is already gone.
      }
    },
    []
  );

  // ---- annotation/bookmark sync ---------------------------------------------
  async function runSync() {
    const store = remoteRef.current;
    if (!store || !loadedIdRef.current) return;
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      do {
        rerunRef.current = false;
        const synced = syncedRef.current;
        const { annotations, bookmarks } = dataRef.current;
        const plan = planSync([...annotations.map(annotationToRecord), ...bookmarks.map(bookmarkToRecord)], synced);
        if (plan.create.length + plan.update.length + plan.remove.length === 0) break;

        setSyncStatus("saving");
        let failed = false;
        for (const id of plan.remove) {
          if (await store.remove(id)) synced.delete(id);
          else failed = true;
        }
        for (const record of plan.create) {
          try {
            await store.create(record);
            markSynced(synced, record);
          } catch {
            failed = true;
          }
        }
        for (const record of plan.update) {
          if (await store.update(record.id, updatePatch(record))) markSynced(synced, record);
          else failed = true;
        }

        if (failed) {
          setSyncStatus("error");
          // Whatever didn't stick is still a difference, so a retry (or the
          // next edit) picks it up. Bounded so a permanently-rejected row
          // can't hammer the server; any new edit starts the count over.
          if (retriesRef.current < MAX_RETRIES) {
            retryTimerRef.current = setTimeout(runSync, RETRY_BASE_MS * 2 ** retriesRef.current);
            retriesRef.current++;
          }
          return;
        }
        retriesRef.current = 0;
        setSyncStatus("saved");
      } while (rerunRef.current);
    } finally {
      runningRef.current = false;
    }
  }

  useEffect(() => {
    if (!remote || !documentId || loadedIdRef.current !== documentId) return;
    retriesRef.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const timer = setTimeout(runSync, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.annotations, data.bookmarks, documentId, loadedId]);

  // Leaving the reader shouldn't strand an edit made in the last moments: flush once on unmount.
  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      void runSync();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const saveStatus: SaveStatus = [syncStatus, localStatus].includes("error")
    ? "error"
    : [syncStatus, localStatus].includes("saving")
      ? "saving"
      : [syncStatus, localStatus].includes("saved")
        ? "saved"
        : "idle";

  const ready = documentId !== null && loadedId === documentId;
  return useMemo(() => ({ data, dispatch, saveStatus, ready, loadError }), [data, saveStatus, ready, loadError]);
}

export type { DocumentData };
