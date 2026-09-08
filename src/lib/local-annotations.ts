// Anonymous-visitor annotation storage. Spec §10/§22: anonymous highlights
// must never go in a cookie (too small, and sent on every request) and never
// touch the server — IndexedDB is the browser-native fit for "possibly a lot
// of structured data, private to this browser." Deliberately hand-rolled
// against the native API rather than pulling in a wrapper library: the
// surface area needed here (one object store, keyed reads/writes, one index)
// is small enough that a dependency would be pure overhead.

export type LocalAnnotation = {
  id: string;
  bookId: string;
  documentVersionId: string;
  location: unknown;
  // Nullable rather than just optional so this shape lines up with what
  // Prisma returns for the same columns (see src/lib/annotation-store.ts,
  // which uses this type for both the local and database-backed stores).
  selectedText?: string | null;
  highlightData?: unknown;
  note?: string | null;
  // string here (IndexedDB) / Date when this same shape holds a row read
  // straight from Prisma (see annotation-store.ts) — nothing in the reader
  // UI does date arithmetic, so both are accepted rather than normalized.
  createdAt: string | Date;
  updatedAt: string | Date;
};

const DB_NAME = "oriental-codex-annotations";
const STORE = "annotations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("bookId", "bookId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function listLocalAnnotations(
  bookId: string,
  documentVersionId?: string
): Promise<LocalAnnotation[]> {
  const db = await openDb();
  const all = await new Promise<LocalAnnotation[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("bookId");
    const req = index.getAll(bookId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
  return documentVersionId ? all.filter((a) => a.documentVersionId === documentVersionId) : all;
}

// Cross-book, for the Highlights page (spec §22's anonymous highlighting
// needs somewhere to review them all, not just one book's reader sidebar).
export async function listAllLocalAnnotations(): Promise<LocalAnnotation[]> {
  return withStore("readonly", (store) => store.getAll());
}

export async function createLocalAnnotation(
  data: Omit<LocalAnnotation, "id" | "createdAt" | "updatedAt">
): Promise<LocalAnnotation> {
  const now = new Date().toISOString();
  const annotation: LocalAnnotation = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await withStore("readwrite", (store) => store.add(annotation));
  return annotation;
}

export async function updateLocalAnnotation(
  id: string,
  patch: Partial<Pick<LocalAnnotation, "note" | "highlightData">>
): Promise<LocalAnnotation | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as LocalAnnotation | undefined;
      if (!existing) {
        resolve(null);
        return;
      }
      const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteLocalAnnotation(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}
