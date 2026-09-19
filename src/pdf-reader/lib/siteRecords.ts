import type { Annotation, AnnotationType, Bookmark, HighlightColor, Point, Rect } from "@/pdf-reader/types";

// The reader's annotations and bookmarks are stored as the site's own
// annotation rows (src/lib/annotation-store.ts: the database for signed-in
// readers, IndexedDB for anonymous ones), not in a reader-private format —
// so everything a reader has already saved keeps working, the /highlights
// page keeps listing it, and it follows a signed-in user across devices.
//
// The row shape predates this reader: { location, selectedText, highlightData,
// note }, where a row with no highlightData is a bookmark. This file is the
// only place that knows how the reader's richer model (five colors, five
// mark types, tags, freehand strokes) maps onto it, and how rows written by
// the classic reader ({ page, color: "gold", rects } — no type) map back.

export type SiteRecord = {
  id: string;
  location: unknown;
  selectedText?: string | null;
  highlightData?: unknown;
  note?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SiteRecordInput = Pick<SiteRecord, "id" | "location" | "selectedText" | "highlightData" | "note">;

/** What the reader needs from the annotation store, already bound to one book + document version. */
export type RecordStore = {
  list(): Promise<SiteRecord[]>;
  /** Rejects on failure. */
  create(input: SiteRecordInput): Promise<unknown>;
  /** Resolve to whether the change actually stuck. */
  update(id: string, patch: { note?: string; highlightData?: unknown; location?: unknown }): Promise<boolean>;
  remove(id: string): Promise<boolean>;
};

// Limits the annotation API enforces (src/app/api/books/[id]/annotations/route.ts).
// Sent longer, a row is rejected outright and would then fail to sync forever,
// so the mapping clips instead.
const MAX_SELECTED_TEXT = 20000;
const MAX_NOTE = 5000;

const TYPES: readonly AnnotationType[] = ["highlight", "underline", "strikethrough", "note", "area", "drawing"];
const COLORS: readonly HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const iso = (d: string | Date) => (typeof d === "string" ? d : d.toISOString());

function pageOf(v: unknown): number | null {
  return isNum(v) && Number.isInteger(v) && v >= 1 ? v : null;
}

function cleanRects(v: unknown): Rect[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is Rect => isObject(r) && isNum(r.x) && isNum(r.y) && isNum(r.w) && isNum(r.h));
}

function cleanPoints(v: unknown): Point[] | null {
  if (!Array.isArray(v)) return null;
  return v.filter((p): p is Point => isObject(p) && isNum(p.x) && isNum(p.y));
}

/** A row with highlightData is an annotation; anything the reader can't make sense of is skipped rather than crashing the page. */
export function recordToAnnotation(r: SiteRecord, documentId: string): Annotation | null {
  const hd = r.highlightData;
  if (!isObject(hd)) return null;
  const loc = isObject(r.location) ? r.location : {};
  const page = pageOf(hd.page) ?? pageOf(loc.page);
  const rects = cleanRects(hd.rects);
  // Foreign data (an EPUB's CFI range, say) has neither a reader type nor
  // page rectangles — not ours to draw.
  if (!page || (hd.type === undefined && rects.length === 0)) return null;
  return {
    id: r.id,
    documentId,
    type: TYPES.includes(hd.type as AnnotationType) ? (hd.type as AnnotationType) : "highlight",
    page,
    // The classic reader's one color was "gold"; the reader's palette calls it yellow (and renders it gold).
    color: COLORS.includes(hd.color as HighlightColor) ? (hd.color as HighlightColor) : "yellow",
    selectedText: r.selectedText ?? null,
    rects,
    points: cleanPoints(hd.points),
    comment: r.note ?? "",
    tags: Array.isArray(hd.tags) ? hd.tags.filter((t): t is string => typeof t === "string") : [],
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    userId: null,
  };
}

/**
 * `page` and `rects` stay at the top level of highlightData exactly where the
 * classic reader wrote them, so the classic reader can still draw (a gold
 * approximation of) anything written here.
 */
export function annotationToRecord(a: Annotation): SiteRecordInput {
  return {
    id: a.id,
    location: { page: a.page },
    selectedText: a.selectedText ? a.selectedText.slice(0, MAX_SELECTED_TEXT) : undefined,
    highlightData: { v: 2, page: a.page, type: a.type, color: a.color, rects: a.rects, points: a.points, tags: a.tags },
    note: a.comment.slice(0, MAX_NOTE),
  };
}

export function recordToBookmark(r: SiteRecord, documentId: string): Bookmark | null {
  if (r.highlightData != null) return null;
  const loc = isObject(r.location) ? r.location : {};
  const page = pageOf(loc.page);
  if (!page) return null;
  return {
    id: r.id,
    documentId,
    page,
    // Classic bookmarks kept their only text in `note`; ones written here keep title/note/tag in `location`.
    title: "title" in loc ? str(loc.title) : (r.note ?? ""),
    note: str(loc.note),
    tag: str(loc.tag),
    createdAt: iso(r.createdAt),
  };
}

/** `note` mirrors the title so the site's own bookmark lists (Highlights page, classic reader) show something meaningful. */
export function bookmarkToRecord(b: Bookmark): SiteRecordInput {
  return {
    id: b.id,
    location: { page: b.page, title: b.title, note: b.note, tag: b.tag },
    note: (b.title || `Page ${b.page}`).slice(0, MAX_NOTE),
  };
}

const signature = (r: SiteRecordInput) => JSON.stringify([r.location, r.selectedText ?? null, r.highlightData ?? null, r.note ?? null]);

/** id -> signature of what the store is known to hold. Compare against this, not against what was last *sent*, so a failed request is retried. */
export type SyncedState = Map<string, string>;

export function syncedStateOf(records: SiteRecordInput[]): SyncedState {
  return new Map(records.map((r) => [r.id, signature(r)]));
}

/** What has to happen to the store for it to match `desired`. */
export function planSync(desired: SiteRecordInput[], synced: SyncedState) {
  const desiredIds = new Set(desired.map((r) => r.id));
  return {
    create: desired.filter((r) => !synced.has(r.id)),
    update: desired.filter((r) => synced.has(r.id) && synced.get(r.id) !== signature(r)),
    remove: [...synced.keys()].filter((id) => !desiredIds.has(id)),
  };
}

export function markSynced(synced: SyncedState, r: SiteRecordInput) {
  synced.set(r.id, signature(r));
}

/** selectedText is set once at creation and the API can't change it, so an update only carries the fields it accepts. */
export function updatePatch(r: SiteRecordInput) {
  return { note: r.note ?? "", location: r.location, ...(r.highlightData !== undefined ? { highlightData: r.highlightData } : {}) };
}
