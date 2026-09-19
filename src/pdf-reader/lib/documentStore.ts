import type { Annotation, Bookmark, CitationFields, ReadingState, ResearchNote, SavedCitation } from "@/pdf-reader/types";
import { emptyCitationFields } from "@/pdf-reader/lib/citation";

// Per-document persisted state: annotations, bookmarks, notes, and reading
// position/preferences all live together under one localStorage key, kept
// separate from the source PDF file itself (the archival file is never
// touched). Reducer actions keep the three concerns distinct internally even
// though they share storage, so pulling any one of them out to a real
// backend later is a matter of swapping the persistence layer, not the
// action shapes.

export type DocumentData = {
  annotations: Annotation[];
  bookmarks: Bookmark[];
  notes: ResearchNote[];
  readingState: ReadingState;
  citationFields: CitationFields;
  savedCitations: SavedCitation[];
};

export const DEFAULT_READING_STATE: ReadingState = {
  currentPage: 1,
  zoomMode: "fit-width",
  zoomLevel: 1,
  layoutMode: "continuous",
  leftSidebarOpen: true,
  leftSidebarTab: "outline",
  leftSidebarDocked: false,
  rightPanelOpen: false,
  rightPanelTab: "annotations",
  rightPanelWidth: 340,
  rightPanelDocked: false,
  rotation: 0,
  flipVertical: false,
  pageOffset: 0,
  lastReadAt: new Date().toISOString(),
};

export function emptyDocumentData(): DocumentData {
  return {
    annotations: [],
    bookmarks: [],
    notes: [],
    readingState: DEFAULT_READING_STATE,
    citationFields: emptyCitationFields(),
    savedCitations: [],
  };
}

export type DocumentAction =
  | { type: "annotation/add"; annotation: Annotation }
  | { type: "annotation/update"; id: string; patch: Partial<Annotation> }
  | { type: "annotation/delete"; id: string }
  | { type: "annotations/replace"; annotations: Annotation[] }
  | { type: "bookmark/add"; bookmark: Bookmark }
  | { type: "bookmark/update"; id: string; patch: Partial<Bookmark> }
  | { type: "bookmark/delete"; id: string }
  | { type: "note/add"; note: ResearchNote }
  | { type: "note/update"; id: string; patch: Partial<ResearchNote> }
  | { type: "note/delete"; id: string }
  | { type: "readingState/patch"; patch: Partial<ReadingState> }
  | { type: "citation/patch"; patch: Partial<CitationFields> }
  | { type: "citationReference/add"; citation: SavedCitation }
  | { type: "citationReference/delete"; id: string }
  | { type: "replace"; data: DocumentData };

export function documentReducer(state: DocumentData, action: DocumentAction): DocumentData {
  switch (action.type) {
    case "annotation/add":
      return { ...state, annotations: [...state.annotations, action.annotation] };
    case "annotation/update":
      return {
        ...state,
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, ...action.patch, updatedAt: new Date().toISOString() } : a
        ),
      };
    case "annotation/delete": {
      // Notes may quote this annotation. Deliberately leave note.quotes
      // untouched: each quote's annotationId keeps pointing at the now-gone
      // id, and ResearchNotesPanel detects "source removed" by checking
      // that id against the live annotations map. Nulling it out here would
      // erase the one piece of information ("this used to be linked") that
      // makes that distinguishable from a quote that was never linked to an
      // annotation in the first place — the quoted text stays either way.
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.id),
      };
    }
    // Undo/redo replays a whole prior annotations array rather than
    // inverting individual add/update/delete patches — simpler to get right
    // than hand-computing inverse patches, at the cost of only per-array
    // (not per-field) granularity, which is what "undo my last change"
    // means anyway.
    case "annotations/replace":
      return { ...state, annotations: action.annotations };
    case "bookmark/add":
      return { ...state, bookmarks: [...state.bookmarks, action.bookmark] };
    case "bookmark/update":
      return {
        ...state,
        bookmarks: state.bookmarks.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)),
      };
    case "bookmark/delete":
      return { ...state, bookmarks: state.bookmarks.filter((b) => b.id !== action.id) };
    case "note/add":
      return { ...state, notes: [...state.notes, action.note] };
    case "note/update":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, ...action.patch, updatedAt: new Date().toISOString() } : n
        ),
      };
    case "note/delete":
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };
    case "readingState/patch":
      return { ...state, readingState: { ...state.readingState, ...action.patch } };
    case "citation/patch":
      return { ...state, citationFields: { ...state.citationFields, ...action.patch } };
    case "citationReference/add":
      return { ...state, savedCitations: [...state.savedCitations, action.citation] };
    case "citationReference/delete":
      return { ...state, savedCitations: state.savedCitations.filter((c) => c.id !== action.id) };
    case "replace":
      return action.data;
  }
}

export function storageKeyFor(documentId: string) {
  return `oriental-archive:reader:doc:${documentId}`;
}

/**
 * `citationDefaults` is what the archive already knows about the book (author,
 * publisher, year...). Anything the reader has typed into a citation field
 * wins; the defaults only fill fields still empty.
 */
export function loadDocumentData(documentId: string, citationDefaults: Partial<CitationFields> = {}): DocumentData {
  const defaults = { ...emptyCitationFields(), ...citationDefaults };
  const withDefaults = (saved: Partial<CitationFields> = {}): CitationFields => {
    const merged = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof CitationFields)[]) merged[key] = saved[key] || defaults[key];
    return merged;
  };
  try {
    const raw = localStorage.getItem(storageKeyFor(documentId));
    if (!raw) return { ...emptyDocumentData(), citationFields: withDefaults() };
    const parsed = JSON.parse(raw) as Partial<DocumentData>;
    return {
      annotations: parsed.annotations ?? [],
      bookmarks: parsed.bookmarks ?? [],
      notes: parsed.notes ?? [],
      readingState: { ...DEFAULT_READING_STATE, ...parsed.readingState },
      citationFields: withDefaults(parsed.citationFields),
      savedCitations: parsed.savedCitations ?? [],
    };
  } catch {
    return { ...emptyDocumentData(), citationFields: withDefaults() };
  }
}

export function saveDocumentData(documentId: string, data: DocumentData) {
  localStorage.setItem(storageKeyFor(documentId), JSON.stringify(data));
}
