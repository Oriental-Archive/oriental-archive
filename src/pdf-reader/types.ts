// Core reader data model. Kept independent of any specific backend so a real
// Oriental Archive document (documentId, documentUrl, metadata, currentUser,
// permissions) can be dropped in later without reshaping these types.

export type Rect = { x: number; y: number; w: number; h: number };

export type HighlightColor = "yellow" | "green" | "blue" | "red" | "purple";

export type AnnotationType = "highlight" | "underline" | "strikethrough" | "note" | "area" | "drawing";

export type Point = { x: number; y: number };

export type Annotation = {
  id: string;
  documentId: string;
  type: AnnotationType;
  page: number;
  color: HighlightColor;
  /** Text the annotation is anchored to, when it has a text anchor (missing for area/drawing annotations on scanned pages). */
  selectedText: string | null;
  rects: Rect[];
  /** Freehand stroke path, normalized 0-1 within the page, for type "drawing" only. */
  points: Point[] | null;
  comment: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  userId: string | null;
};

export type Bookmark = {
  id: string;
  documentId: string;
  page: number;
  title: string;
  note: string;
  tag: string;
  createdAt: string;
};

/** A quoted passage embedded in a research note, linking back to its source. */
export type NoteQuote = {
  annotationId: string | null; // null if the source annotation was later deleted
  page: number;
  text: string;
};

export type ResearchNote = {
  id: string;
  documentId: string;
  title: string;
  body: string; // lightweight markdown-ish plain text
  quotes: NoteQuote[];
  createdAt: string;
  updatedAt: string;
};

export type OutlineNode = {
  title: string;
  page: number | null;
  children: OutlineNode[];
};

export type DocumentMetadata = {
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  creator: string | null;
  producer: string | null;
  creationDate: string | null;
  modificationDate: string | null;
  language: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number;
};

/** User-editable bibliographic fields the PDF's own metadata can't supply. */
export type CitationFields = {
  title: string;
  alternativeTitle: string;
  author: string;
  editor: string;
  translator: string;
  publisher: string;
  publicationDate: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  language: string;
  isbn: string;
  doi: string;
  url: string;
  archiveId: string;
};

export type CitationStyle = "chicago" | "mla" | "apa" | "turabian" | "bibtex" | "ris";

/**
 * A citation the reader explicitly chose to keep, distinct from citations
 * folded into a research note's prose. Stores the style + anchor rather than
 * a rendered string — structured metadata, not a frozen string, is what
 * lets a real reference-manager integration (or a later style change) work
 * with these later, per the "store structured metadata" requirement.
 */
export type SavedCitation = {
  id: string;
  documentId: string;
  page: number;
  text: string;
  style: CitationStyle;
  createdAt: string;
};

export type PermissionSet = {
  view: boolean;
  download: boolean;
  annotate: boolean;
  copyText: boolean;
  print: boolean;
  exportAnnotations: boolean;
};

export const DEFAULT_PERMISSIONS: PermissionSet = {
  view: true,
  download: true,
  annotate: true,
  copyText: true,
  print: true,
  exportAnnotations: true,
};

export type ToolId =
  | "select"
  | "pan"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "draw"
  | "note"
  | "area"
  | "comment";

export type ZoomMode = "fit-width" | "fit-page" | "actual-size" | "custom";
export type LayoutMode = "continuous" | "single" | "two-page";
export type ReaderMode = "standard" | "focus" | "presentation";
export type PdfAppearance = "original" | "dimmed" | "inverted";

/** How the user reads: one continuous scroll, or discrete pages (book mode). Persisted per user. */
export type ReadingMode = "scroll" | "pageTurn";
/** Page-turn only: show a two-page spread when the screen is wide enough ("auto"), never, or always. */
export type SpreadMode = "auto" | "off" | "on";
export type PageAnimation = "on" | "reduced" | "off";
export type ThemePreference = "light" | "dark" | "system";

export type ReadingState = {
  currentPage: number;
  zoomMode: ZoomMode;
  zoomLevel: number;
  layoutMode: LayoutMode;
  leftSidebarOpen: boolean;
  leftSidebarTab: "pages" | "outline" | "bookmarks" | "search";
  /** Forces the left sidebar to render as a persistent panel instead of an overlay drawer, even below the desktop breakpoint. */
  leftSidebarDocked: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: "annotations" | "notes" | "references" | "info";
  rightPanelWidth: number;
  /** Forces the research panel to render as a persistent panel instead of a drawer/bottom sheet, even below the desktop breakpoint. */
  rightPanelDocked: boolean;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  /** Fraction (0-1) of the current page's height sitting at the top of the viewport, so "where I was" survives a reopen, not just which page. */
  pageOffset: number;
  lastReadAt: string;
};

export type NavHistoryEntry = { page: number; label?: string };

export type NewAnnotationInput = Pick<
  Annotation,
  "id" | "type" | "page" | "color" | "selectedText" | "rects" | "points" | "comment" | "tags"
>;

export type PendingSelection = {
  text: string;
  rects: Rect[];
  page: number;
  /** Selection bounds as 0-1 fractions of the page: horizontal center, top of the first line, bottom of the last. Fractions (not px) so the toolbar stays put through zoom. */
  anchor: { x: number; top: number; bottom: number };
};

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";

export type ZoteroConnection = { connected: false; reason: "not-configured" };
