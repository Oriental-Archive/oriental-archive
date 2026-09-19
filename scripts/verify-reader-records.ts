import assert from "node:assert/strict";
import {
  annotationToRecord,
  bookmarkToRecord,
  markSynced,
  planSync,
  recordToAnnotation,
  recordToBookmark,
  syncedStateOf,
  updatePatch,
  type SiteRecord,
} from "../src/pdf-reader/lib/siteRecords";

// Self-check for how the PDF reader's annotations map onto the site's
// annotation rows (src/pdf-reader/lib/siteRecords.ts) and for the sync
// planner that keeps the store matching the reader. Pure functions, no
// database or browser needed.
//
// The properties that matter most: rows the classic reader already saved
// load correctly, and merely *opening* them never causes a write.
//
// Run with: npm run verify:reader-records

const DOC = "version-1";
const NOW = "2026-09-01T00:00:00.000Z";
const row = (r: Partial<SiteRecord> & { id: string }): SiteRecord => ({ location: {}, createdAt: NOW, updatedAt: NOW, ...r });

// ---- rows written by the classic reader ------------------------------------
const classicHighlight = row({
  id: "h1",
  location: { page: 3 },
  selectedText: "the Word became flesh",
  highlightData: { page: 3, color: "gold", rects: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.02 }] },
  note: "Jn 1:14",
});
const classicBookmark = row({ id: "b1", location: { page: 5 }, note: "Start of chapter 2" });
const classicBareBookmark = row({ id: "b2", location: { page: 9 }, note: null });

const a = recordToAnnotation(classicHighlight, DOC);
assert.ok(a, "classic highlight loads");
assert.equal(a.type, "highlight");
assert.equal(a.color, "yellow", "classic 'gold' maps to the reader's yellow");
assert.equal(a.page, 3);
assert.equal(a.comment, "Jn 1:14");
assert.equal(a.rects.length, 1);
console.log("ok — classic highlight loads as a yellow highlight");

const b = recordToBookmark(classicBookmark, DOC);
assert.ok(b);
assert.equal(b.page, 5);
assert.equal(b.title, "Start of chapter 2", "classic bookmark text becomes its title");
assert.equal(recordToBookmark(classicBareBookmark, DOC)?.title, "");
assert.equal(recordToAnnotation(classicBookmark, DOC), null, "a bookmark is not an annotation");
assert.equal(recordToBookmark(classicHighlight, DOC), null, "a highlight is not a bookmark");
console.log("ok — classic bookmarks load, and the two kinds never cross over");

// ---- opening legacy rows must not write anything --------------------------
{
  const annotations = [classicHighlight].flatMap((r) => recordToAnnotation(r, DOC) ?? []);
  const bookmarks = [classicBookmark, classicBareBookmark].flatMap((r) => recordToBookmark(r, DOC) ?? []);
  const desired = [...annotations.map(annotationToRecord), ...bookmarks.map(bookmarkToRecord)];
  const plan = planSync(desired, syncedStateOf(desired));
  assert.deepEqual([plan.create.length, plan.update.length, plan.remove.length], [0, 0, 0]);
  console.log("ok — opening classic-reader data plans zero writes");
}

// ---- every annotation kind survives a round trip --------------------------
for (const type of ["highlight", "underline", "strikethrough", "note", "area", "drawing"] as const) {
  const original = {
    id: `id-${type}`,
    documentId: DOC,
    type,
    page: 12,
    color: "purple" as const,
    selectedText: type === "area" || type === "drawing" ? null : "sample text",
    rects: type === "drawing" ? [] : [{ x: 0.1, y: 0.1, w: 0.2, h: 0.05 }],
    points: type === "drawing" ? [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.3 }] : null,
    comment: "a comment",
    tags: ["christology", "nicaea"],
    createdAt: NOW,
    updatedAt: NOW,
    userId: null,
  };
  const rec = annotationToRecord(original);
  // JSON round trip: what actually travels to and from the API / IndexedDB.
  const back = recordToAnnotation({ ...JSON.parse(JSON.stringify(rec)), createdAt: NOW, updatedAt: NOW }, DOC);
  assert.deepEqual(back, original, `${type} round-trips`);
}
console.log("ok — all six annotation types round-trip through the store format");

{
  const bookmark = { id: "bk", documentId: DOC, page: 7, title: "", note: "see also p. 40", tag: "todo", createdAt: NOW };
  const rec = bookmarkToRecord(bookmark);
  assert.equal(rec.note, "Page 7", "an untitled bookmark still reads sensibly on the Highlights page");
  assert.equal(rec.highlightData, undefined, "a bookmark must stay a bookmark (no highlightData)");
  assert.deepEqual(recordToBookmark({ ...JSON.parse(JSON.stringify(rec)), createdAt: NOW, updatedAt: NOW }, DOC), bookmark);
  console.log("ok — bookmarks round-trip and stay bookmarks");
}

// ---- classic reader can still draw what this writes ------------------------
{
  const rec = annotationToRecord(a);
  const hd = rec.highlightData as { page: number; rects: unknown[] };
  assert.equal(hd.page, 3);
  assert.ok(Array.isArray(hd.rects), "page + rects stay top-level, where the classic reader reads them");
  console.log("ok — new-format rows remain readable by ?reader=classic");
}

// ---- hostile / foreign data is skipped, not crashed on ---------------------
assert.equal(recordToAnnotation(row({ id: "e1", highlightData: { cfiRange: "epubcfi(/6/4)" } }), DOC), null);
assert.equal(recordToAnnotation(row({ id: "e2", highlightData: { page: "x", rects: "nope" } }), DOC), null);
assert.equal(recordToAnnotation(row({ id: "e3", highlightData: { page: 0, rects: [{ x: 0, y: 0, w: 1, h: 1 }] } }), DOC), null);
assert.equal(recordToBookmark(row({ id: "e4", location: { page: -2 } }), DOC), null);
assert.equal(recordToBookmark(row({ id: "e5", location: null }), DOC), null);
const junkRects = recordToAnnotation(
  row({ id: "e6", location: { page: 2 }, highlightData: { page: 2, rects: [{ x: 1, y: 1, w: 1, h: 1 }, { x: "a" }, null, NaN] } }),
  DOC
);
assert.equal(junkRects?.rects.length, 1, "malformed rects are dropped, good ones kept");
console.log("ok — foreign or malformed rows are skipped instead of crashing the reader");

// ---- limits the API enforces: clip rather than get rejected forever --------
{
  const rec = annotationToRecord({ ...a, selectedText: "x".repeat(25000), comment: "y".repeat(6000) });
  assert.equal(rec.selectedText?.length, 20000);
  assert.equal(rec.note?.length, 5000);
  console.log("ok — over-long text is clipped to the API's limits");
}

// ---- the sync planner ------------------------------------------------------
{
  const base = annotationToRecord(a);
  const synced = syncedStateOf([base]);

  const edited = annotationToRecord({ ...a, comment: "changed" });
  let plan = planSync([edited], synced);
  assert.deepEqual([plan.create.length, plan.update.length, plan.remove.length], [0, 1, 0], "an edit is one update");
  assert.deepEqual(Object.keys(updatePatch(edited)).sort(), ["highlightData", "location", "note"], "update only sends fields the API accepts");

  const added = annotationToRecord({ ...a, id: "new" });
  plan = planSync([base, added], synced);
  assert.deepEqual([plan.create.map((r) => r.id), plan.update.length, plan.remove.length], [["new"], 0, 0], "a new mark is one create");

  plan = planSync([], synced);
  assert.deepEqual(plan.remove, [a.id], "a deletion is one remove");

  // Undo of a delete (same id comes back) after the delete already synced.
  synced.delete(a.id);
  plan = planSync([base], synced);
  assert.deepEqual(plan.create.map((r) => r.id), [a.id], "redo/undo re-creates with the same id");

  // A failed request leaves the state un-marked, so the next pass retries it.
  plan = planSync([base], synced);
  assert.equal(plan.create.length, 1, "un-marked = still pending");
  markSynced(synced, base);
  assert.equal(planSync([base], synced).create.length, 0, "marked = done");

  console.log("ok — sync planner: minimal writes, idempotent, retry-safe");
}

console.log("\nAll reader-record checks passed.");
