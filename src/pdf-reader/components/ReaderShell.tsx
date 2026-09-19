import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Annotation, CitationFields, HighlightColor, LayoutMode, NewAnnotationInput, PermissionSet, ReaderMode, ToolId, ZoomMode } from "@/pdf-reader/types";
import type { RecordStore } from "@/pdf-reader/lib/siteRecords";
import { usePdfDocument } from "@/pdf-reader/hooks/usePdfDocument";
import { useDocumentStore } from "@/pdf-reader/hooks/useDocumentStore";
import { useAnnotationHistory } from "@/pdf-reader/hooks/useAnnotationHistory";
import { useAppSettings } from "@/pdf-reader/hooks/useAppSettings";
import { useNavigationHistory } from "@/pdf-reader/hooks/useNavigationHistory";
import { usePdfSearch } from "@/pdf-reader/hooks/usePdfSearch";
import { useKeyboardShortcuts } from "@/pdf-reader/hooks/useKeyboardShortcuts";
import { useDeviceProfile } from "@/pdf-reader/hooks/useDeviceProfile";
import { useKeyboardInset } from "@/pdf-reader/hooks/useKeyboardInset";
import { chapterFor } from "@/pdf-reader/lib/outline";
import { ReaderHeader } from "@/pdf-reader/components/layout/ReaderHeader";
import { ReaderToolbar } from "@/pdf-reader/components/toolbar/ReaderToolbar";
import { LeftSidebar, type LeftTab } from "@/pdf-reader/components/layout/LeftSidebar";
import { RightResearchPanel, type RightTab } from "@/pdf-reader/components/layout/RightResearchPanel";
import { PDFViewport, type PdfViewportHandle } from "@/pdf-reader/components/pdf/PDFViewport";
import { CommandPalette, type Command } from "@/pdf-reader/components/dialogs/CommandPalette";
import { KeyboardShortcutsDialog } from "@/pdf-reader/components/dialogs/KeyboardShortcutsDialog";
import { CitationDialog } from "@/pdf-reader/components/dialogs/CitationDialog";
import { AnnotationEditor } from "@/pdf-reader/components/dialogs/AnnotationEditor";
import { ReaderSettingsDialog } from "@/pdf-reader/components/dialogs/ReaderSettingsDialog";
import { FloatingBanner } from "@/pdf-reader/components/status/FloatingBanner";
import { DocumentInfoPanel } from "@/pdf-reader/components/layout/DocumentInfoPanel";
import { Modal } from "@/pdf-reader/components/common/Modal";
import { BottomSheet } from "@/pdf-reader/components/common/BottomSheet";
import type { DocumentMetadata } from "@/pdf-reader/types";
import { FocusControlBar } from "@/pdf-reader/components/status/FocusControlBar";
import { PresentationControls } from "@/pdf-reader/components/status/PresentationControls";
import { PresentationPageChanger } from "@/pdf-reader/components/status/PresentationPageChanger";
import { TouchBottomBar, TouchSearchBar, TouchSearchControls, TouchTopBar } from "@/pdf-reader/components/touch/TouchBars";
import { MoreSheet, NavigationSheet, ZoomSheet, type NavTab } from "@/pdf-reader/components/touch/TouchSheets";
import { ToolPill } from "@/pdf-reader/components/touch/ToolPill";
import {
  DocumentLoadingState,
  DocumentErrorState,
  PasswordPrompt,
} from "@/pdf-reader/components/status/DocumentLoadState";

const CHROME_AUTOHIDE_MS = 4500;
const POSITION_SAVE_MS = 500;
const ANNOTATION_LABEL: Record<Annotation["type"], string> = {
  highlight: "Highlight added",
  underline: "Underline added",
  strikethrough: "Strikethrough added",
  note: "Note added",
  area: "Area added",
  drawing: "Drawing added",
};

/** Everything the Oriental Archive site supplies about the book being read. */
export type ReaderHost = {
  /** Stable per document version; keys this browser's saved notes, citations and reading position. */
  documentId: string;
  fileUrl: string;
  fileName: string;
  title: string;
  author: string | null;
  /** Highlights and bookmarks, already bound to this book and document version. */
  store: RecordStore;
  /** Mirrors what the file endpoint itself will allow — the UI just doesn't offer what the server would refuse. */
  permissions: PermissionSet;
  /** The gated download endpoint. Only reached when permissions.download / permissions.print allow it. */
  downloadUrl: string;
  /** What the archive already knows about the book, to pre-fill its citation. */
  citationDefaults: Partial<CitationFields>;
  /** Back to the book's page. */
  onExit: () => void;
};

export function ReaderShell({ host }: { host: ReaderHost }) {
  const { documentId, permissions: perms } = host;
  const { status, pdf, metadata, outline, error, submitPassword, retry } = usePdfDocument({
    url: host.fileUrl,
    fileName: host.fileName,
    title: host.title,
    author: host.author,
  });
  const { data, dispatch, saveStatus, ready, loadError } = useDocumentStore(documentId, host.store, host.citationDefaults);
  const annotationHistory = useAnnotationHistory(documentId, data.annotations, dispatch);
  const { settings, update: updateSettings } = useAppSettings();
  const profile = useDeviceProfile();
  useKeyboardInset();

  // Interaction model, not just width: phones and tablets get the immersive
  // touch reader (controls appear on tap, secondary tools in sheets); only
  // roomy screens get the persistent-toolbar research desktop.
  const touchLayout = profile.form !== "desktop";

  const viewportRef = useRef<PdfViewportHandle>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [liveScale, setLiveScale] = useState(1);
  const [pageAspect, setPageAspect] = useState(1.294);
  const [activeTool, setActiveTool] = useState<ToolId>("select");
  const [pendingColor, setPendingColorState] = useState<HighlightColor>(settings.defaultHighlightColor);
  // The highlight color is remembered across sessions: whatever you last picked anywhere is what the next highlight uses.
  const setPendingColor = useCallback(
    (c: HighlightColor) => {
      setPendingColorState(c);
      updateSettings({ defaultHighlightColor: c });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [readerMode, setReaderMode] = useState<ReaderMode>("standard");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [laserPointerActive, setLaserPointerActive] = useState(false);
  useEffect(() => {
    if (readerMode !== "presentation") setLaserPointerActive(false);
  }, [readerMode]);
  // Presentation/focus are desktop-chrome concepts; don't strand a phone-sized window in one.
  useEffect(() => {
    if (touchLayout && readerMode !== "standard") setReaderMode("standard");
  }, [touchLayout, readerMode]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [citationTarget, setCitationTarget] = useState<{ page: number; text: string } | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [pendingQuote, setPendingQuote] = useState<{ page: number; text: string; annotationId: string | null } | null>(null);

  // ---- touch chrome state -------------------------------------------------
  type Sheet = null | "nav" | "more" | "zoom" | "research";
  const [chromeVisible, setChromeVisible] = useState(false);
  const [chromeTick, setChromeTick] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [navTab, setNavTab] = useState<NavTab>("contents");
  const [searchActive, setSearchActive] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [selectionActive, setSelectionActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [undoToast, setUndoToast] = useState<{ id: number; label: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadErrorDismissed, setLoadErrorDismissed] = useState(false);

  const positionReadyRef = useRef(false);
  const positionRef = useRef<{ page: number; offset: number }>({ page: 1, offset: 0 });
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resume, setResume] = useState<{ page: number; offset: number } | null>(null);
  const [resumeBanner, setResumeBanner] = useState<number | null>(null);
  const restoredForRef = useRef<string | null>(null);
  // The viewport mounts only once the saved place is known, so it opens *at* it (a scroll set after mount
  // races the view's own first layout).
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  const searchState = usePdfSearch(pdf);

  // ---- theme ---------------------------------------------------------------
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSystemDark(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const effectiveTheme: "light" | "dark" = settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;
  const toggleTheme = () => updateSettings({ theme: effectiveTheme === "dark" ? "light" : "dark" });

  // ---- reading state -------------------------------------------------------
  const rs = data.readingState;
  function patchReadingState(patch: Partial<typeof rs>) {
    dispatch({ type: "readingState/patch", patch });
  }

  // Reading mode is a *user* preference (it follows you between books), so it
  // lives in settings, not in per-document reading state.
  // A phone never shows facing pages, whatever the (shared) preference says.
  const spreadOn =
    profile.form !== "phone" && (settings.spread === "on" || (settings.spread === "auto" && profile.landscape && profile.width >= 1000));
  const readingLayout: LayoutMode = settings.readingMode === "scroll" ? "continuous" : spreadOn ? "two-page" : "single";
  const layoutMode: LayoutMode = readerMode === "presentation" ? "single" : readingLayout;
  const pageTurnMode = layoutMode !== "continuous";
  const pageAnimation = settings.pageAnimation === "on" && profile.reducedMotion ? "reduced" : settings.pageAnimation;

  function setLayoutChoice(m: LayoutMode) {
    if (m === "continuous") updateSettings({ readingMode: "scroll" });
    else updateSettings({ readingMode: "pageTurn", spread: m === "two-page" ? "on" : "off" });
  }

  // Restore where the reader was — page *and* position within it — once this
  // document's saved data is actually loaded (not while `data` is still the
  // previous document's), then say so with a one-tap way back to the start.
  useEffect(() => {
    if (!documentId || !ready || status !== "loaded") return;
    if (restoredForRef.current === documentId) return;
    restoredForRef.current = documentId;
    const saved = data.readingState;
    if (settings.rememberLastPosition && (saved.currentPage > 1 || saved.pageOffset > 0.02)) {
      setResume({ page: saved.currentPage, offset: saved.pageOffset });
      setCurrentPage(saved.currentPage);
      positionRef.current = { page: saved.currentPage, offset: saved.pageOffset };
      if (saved.currentPage > 1) setResumeBanner(saved.currentPage);
    } else {
      setCurrentPage(1);
      setResume(null);
    }
    positionReadyRef.current = true;
    setRestoredFor(documentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, ready, status]);
  useEffect(() => {
    if (!documentId) {
      restoredForRef.current = null;
      positionReadyRef.current = false;
      setRestoredFor(null);
    }
  }, [documentId]);

  const navHistory = useNavigationHistory((page) => {
    setCurrentPage(page);
    viewportRef.current?.goToPage(page);
  });

  useEffect(() => navHistory.recordCurrentPage(currentPage), [currentPage, navHistory]);

  function handlePageChange(page: number) {
    setCurrentPage(page);
    if (positionReadyRef.current) {
      dispatch({ type: "readingState/patch", patch: { currentPage: page } });
    }
  }

  // Scroll position within a page changes on every frame of a scroll; persist it once the reader pauses.
  const handlePositionChange = useCallback(
    (page: number, offset: number) => {
      positionRef.current = { page, offset };
      if (!positionReadyRef.current) return;
      if (positionTimer.current) clearTimeout(positionTimer.current);
      positionTimer.current = setTimeout(() => {
        dispatch({ type: "readingState/patch", patch: { currentPage: page, pageOffset: offset } });
      }, POSITION_SAVE_MS);
    },
    [dispatch]
  );
  useEffect(() => () => {
    if (positionTimer.current) clearTimeout(positionTimer.current);
  }, []);

  function startOver() {
    setResumeBanner(null);
    goToPage(1);
  }

  const annotationsById = useMemo(() => new Map(data.annotations.map((a) => [a.id, a])), [data.annotations]);

  const handleCreateAnnotation = useCallback(
    (input: NewAnnotationInput, opensEditor: boolean) => {
      if (!perms.annotate) return;
      const now = new Date().toISOString();
      const annotation: Annotation = { ...input, documentId, userId: null, createdAt: now, updatedAt: now };
      annotationHistory.record({ type: "annotation/add", annotation });
      if (opensEditor) setEditingAnnotationId(annotation.id);
      else setUndoToast({ id: Date.now(), label: ANNOTATION_LABEL[annotation.type] });
    },
    [documentId, annotationHistory, perms.annotate]
  );
  useEffect(() => {
    if (resumeBanner === null) return;
    const t = setTimeout(() => setResumeBanner(null), 7000);
    return () => clearTimeout(t);
  }, [resumeBanner]);
  useEffect(() => {
    if (!undoToast) return;
    const t = setTimeout(() => setUndoToast(null), 4500);
    return () => clearTimeout(t);
  }, [undoToast]);

  function handleAddBookmark() {
    if (!documentId) return;
    const existing = data.bookmarks.find((b) => b.page === currentPage);
    if (existing) {
      dispatch({ type: "bookmark/delete", id: existing.id });
      return;
    }
    dispatch({
      type: "bookmark/add",
      bookmark: { id: crypto.randomUUID(), documentId, page: currentPage, title: "", note: "", tag: "", createdAt: new Date().toISOString() },
    });
  }

  function handleCreateNote(): string {
    if (!documentId) return "";
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    dispatch({ type: "note/add", note: { id, documentId, title: "", body: "", quotes: [], createdAt: now, updatedAt: now } });
    return id;
  }

  async function handleCopy(text: string) {
    if (!perms.copyText) return;
    await navigator.clipboard.writeText(text);
  }
  async function handleQuoteCopy(page: number, text: string) {
    if (!perms.copyText) return;
    await navigator.clipboard.writeText(`"${text}" (p. ${page})`);
  }
  function handleAddToNotes(page: number, text: string, annotationId: string | null = null) {
    setPendingQuote({ page, text, annotationId });
    openRight("notes");
  }
  function handleCite(page: number, text: string) {
    setCitationTarget({ page, text });
  }

  function handleInternalLink(destPage: number) {
    navHistory.pushJump(currentPage);
    setCurrentPage(destPage);
    viewportRef.current?.goToPage(destPage);
  }

  function goToPage(page: number) {
    setCurrentPage(page);
    viewportRef.current?.goToPage(page);
  }

  // The scrubber's preview needs the page shape (rotation swaps it), which the viewport also learns — read page 1 once.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    pdf.getPage(1).then((p) => {
      if (cancelled) return;
      const vp = p.getViewport({ scale: 1, rotation: rs.rotation });
      setPageAspect(vp.height / vp.width);
    });
    return () => {
      cancelled = true;
    };
  }, [pdf, rs.rotation]);

  // Presentation mode is meant to show pages large for an audience, but zoom
  // is otherwise a persisted reading preference — left alone, a small custom
  // zoom carried over from normal reading left presentation mode showing a
  // tiny page in a sea of empty background. Force a full-page fit on entry,
  // and put back whatever zoom reading was using once presentation ends.
  const presentationZoomBackupRef = useRef<{ zoomMode: typeof rs.zoomMode; zoomLevel: number } | null>(null);
  const prevReaderModeRef = useRef(readerMode);
  useEffect(() => {
    if (readerMode === "presentation" && prevReaderModeRef.current !== "presentation") {
      presentationZoomBackupRef.current = { zoomMode: rs.zoomMode, zoomLevel: rs.zoomLevel };
      patchReadingState({ zoomMode: "fit-page" });
    } else if (readerMode !== "presentation" && prevReaderModeRef.current === "presentation" && presentationZoomBackupRef.current) {
      patchReadingState(presentationZoomBackupRef.current);
      presentationZoomBackupRef.current = null;
    }
    prevReaderModeRef.current = readerMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerMode]);
  // Bases the next zoom step on the *requested* zoom level (readingState),
  // not the live rendered scale — the rendered scale only catches up a
  // render or two later, so basing increments on it makes rapid clicks
  // compute the same target twice instead of accumulating.
  function stepZoom(delta: number) {
    const base = rs.zoomMode === "custom" ? rs.zoomLevel : liveScale;
    patchReadingState({ zoomMode: "custom", zoomLevel: Math.min(6, Math.max(0.25, base + delta)) });
  }
  function applyZoomPreset(p: "fit-width" | "fit-page" | number) {
    if (p === "fit-width" || p === "fit-page") patchReadingState({ zoomMode: p });
    else if (p === 1) patchReadingState({ zoomMode: "actual-size" });
    else patchReadingState({ zoomMode: "custom", zoomLevel: p });
  }

  // ---- desktop side panels -----------------------------------------------
  const leftOpen = rs.leftSidebarOpen;
  const rightOpen = rs.rightPanelOpen;
  function openLeft(tab?: typeof rs.leftSidebarTab) {
    if (touchLayout) {
      if (tab === "search") startTouchSearch();
      else {
        setNavTab(tab === "pages" ? "pages" : tab === "bookmarks" ? "bookmarks" : "contents");
        setSheet("nav");
      }
      return;
    }
    patchReadingState({ leftSidebarOpen: true, ...(tab ? { leftSidebarTab: tab } : {}) });
  }
  function toggleLeft() {
    if (touchLayout) setSheet((s) => (s === "nav" ? null : "nav"));
    else patchReadingState({ leftSidebarOpen: !rs.leftSidebarOpen });
  }
  function openRight(tab?: typeof rs.rightPanelTab) {
    if (tab) patchReadingState({ rightPanelTab: tab });
    if (touchLayout) setSheet("research");
    else patchReadingState({ rightPanelOpen: true });
  }
  function toggleRight() {
    if (touchLayout) setSheet((s) => (s === "research" ? null : "research"));
    else patchReadingState({ rightPanelOpen: !rs.rightPanelOpen });
  }
  function closeRight() {
    if (touchLayout) setSheet(null);
    else patchReadingState({ rightPanelOpen: false });
  }

  // ---- touch chrome behavior ----------------------------------------------
  const bumpChrome = useCallback(() => setChromeTick((n) => n + 1), []);
  const overlayOpen = !!sheet || searchActive || scrubbing;
  // Controls appear on a tap and leave on their own; a selection or an armed tool takes the screen instead.
  const chromeShown = touchLayout && chromeVisible && !selectionActive;

  useEffect(() => {
    if (touchLayout && status === "loaded") setChromeVisible(true);
  }, [touchLayout, status, documentId]);
  useEffect(() => {
    if (!chromeVisible || overlayOpen) return;
    const t = setTimeout(() => setChromeVisible(false), CHROME_AUTOHIDE_MS);
    return () => clearTimeout(t);
  }, [chromeVisible, overlayOpen, chromeTick]);

  const onCenterTap = useCallback(() => {
    if (overlayOpen) return;
    setChromeVisible((v) => !v);
  }, [overlayOpen]);

  function startTouchSearch() {
    setSheet(null);
    setSearchActive(true);
    setChromeVisible(true);
  }
  function closeTouchSearch() {
    setSearchActive(false);
    searchState.clear();
  }
  // Submitting a search should land on the first hit, not leave you staring at where you were.
  const lastMatchesRef = useRef(searchState.matches);
  useEffect(() => {
    if (searchState.matches !== lastMatchesRef.current) {
      lastMatchesRef.current = searchState.matches;
      if (touchLayout && searchActive && searchState.matches.length > 0) goToPage(searchState.matches[0].page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchState.matches]);
  function stepSearch(delta: number) {
    const total = searchState.matches.length;
    if (total === 0) return;
    const next = (searchState.activeIndex + delta + total) % total;
    searchState.setActiveIndex(next);
    goToPage(searchState.matches[next].page);
  }

  useEffect(() => {
    const on = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  // Download and print both go through the file endpoint's own download check
  // rather than the copy already open in the viewer: that check (allowDownload)
  // is what actually decides, and hiding a menu item is only courtesy.
  function handleDownload() {
    if (!perms.download) return;
    const a = document.createElement("a");
    a.href = host.downloadUrl;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  async function handlePrint() {
    if (!perms.print) return;
    let url: string;
    try {
      const res = await fetch(host.downloadUrl);
      if (!res.ok) throw new Error(String(res.status));
      url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "application/pdf" }));
    } catch {
      setNotice("Couldn't prepare the document for printing.");
      return;
    }
    // iOS Safari can't print a PDF from a hidden frame; its own viewer offers Print from the share sheet.
    if (/iP(hone|ad|od)/.test(navigator.userAgent)) {
      window.open(url, "_blank");
      return;
    }
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden";
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, "_blank");
      }
      setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60000);
    };
    document.body.appendChild(frame);
  }

  function exitDocument() {
    if (positionTimer.current) clearTimeout(positionTimer.current);
    if (positionReadyRef.current) {
      const { page, offset } = positionRef.current;
      dispatch({ type: "readingState/patch", patch: { currentPage: page, pageOffset: offset } });
    }
    host.onExit();
  }

  useKeyboardShortcuts({
    search: () => (touchLayout ? startTouchSearch() : openLeft("search")),
    zoomIn: () => stepZoom(0.1),
    zoomOut: () => stepZoom(-0.1),
    zoomReset: () => patchReadingState({ zoomMode: settings.defaultZoomMode }),
    bookmark: handleAddBookmark,
    highlightMode: () => setActiveTool("highlight"),
    newNote: () => setActiveTool("note"),
    escape: () => {
      if (searchActive) closeTouchSearch();
      else if (readerMode !== "standard") setReaderMode("standard");
      else if (activeTool !== "select") setActiveTool("select");
      else if (touchLayout) setChromeVisible((v) => !v);
    },
    nextPage: () => viewportRef.current?.stepPage(1),
    prevPage: () => viewportRef.current?.stepPage(-1),
    firstPage: () => goToPage(1),
    lastPage: () => metadata && goToPage(metadata.pageCount),
    commandPalette: () => setCommandPaletteOpen(true),
    toggleLeftSidebar: toggleLeft,
    toggleRightPanel: toggleRight,
    focusMode: () => setReaderMode((m) => (m === "focus" ? "standard" : "focus")),
    undo: annotationHistory.undo,
    redo: annotationHistory.redo,
    drawMode: () => setActiveTool("draw"),
    laserPointer: () => readerMode === "presentation" && setLaserPointerActive((v) => !v),
    // Arrow keys turn pages only where pages *are* turned (page-turn or presentation) —
    // in continuous scroll they keep their native job (scroll/pan).
    ...(pageTurnMode || readerMode === "presentation"
      ? {
          presentationNextPage: () => viewportRef.current?.stepPage(1),
          presentationPrevPage: () => viewportRef.current?.stepPage(-1),
        }
      : {}),
  });

  const commands: Command[] = pdf
    ? [
        { id: "search", label: "Search document", shortcut: "Mod+F", run: () => openLeft("search") },
        { id: "bookmark", label: "Bookmark page", shortcut: "B", run: handleAddBookmark },
        { id: "note", label: "Add note", shortcut: "N", run: () => setActiveTool("note") },
        { id: "undo", label: "Undo", shortcut: "Mod+Z", run: annotationHistory.undo },
        { id: "redo", label: "Redo", shortcut: "Mod+Shift+Z", run: annotationHistory.redo },
        { id: "toggle-annotations", label: "Toggle annotation visibility", run: () => setShowAnnotations((v) => !v) },
        { id: "toggle-left", label: "Toggle left sidebar", shortcut: "Mod+Shift+L", run: toggleLeft },
        { id: "toggle-right", label: "Toggle right panel", shortcut: "Mod+Shift+R", run: toggleRight },
        { id: "fit-width", label: "Fit width", run: () => patchReadingState({ zoomMode: "fit-width" }) },
        { id: "fit-page", label: "Fit page", run: () => patchReadingState({ zoomMode: "fit-page" }) },
        { id: "page-turn", label: settings.readingMode === "scroll" ? "Switch to page-turn mode" : "Switch to continuous scroll", run: () => setLayoutChoice(settings.readingMode === "scroll" ? "single" : "continuous") },
        { id: "copy-citation", label: "Copy citation", run: () => openRight("references") },
        { id: "doc-info", label: "Document information", run: () => setInfoOpen(true) },
        ...(perms.download ? [{ id: "download", label: "Download PDF", run: handleDownload }] : []),
        ...(perms.print ? [{ id: "print", label: "Print", run: handlePrint }] : []),
        { id: "dark-mode", label: "Toggle dark mode", run: toggleTheme },
        { id: "shortcuts", label: "Open keyboard shortcuts", run: () => setShortcutsOpen(true) },
      ]
    : [];

  const loaded = status === "loaded" && !!pdf && !!metadata && restoredFor === documentId;

  const viewport =
    loaded && pdf && metadata ? (
      <PDFViewport
        ref={viewportRef}
        pdf={pdf}
        numPages={metadata.pageCount}
        annotations={data.annotations}
        showAnnotations={showAnnotations}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        zoomMode={rs.zoomMode}
        zoomLevel={rs.zoomLevel}
        onZoomLevelChange={(level) => patchReadingState({ zoomMode: "custom", zoomLevel: level })}
        onZoomModeChange={(m: ZoomMode) => patchReadingState({ zoomMode: m })}
        onScaleChange={setLiveScale}
        smoothScrolling={settings.smoothScrolling}
        layoutMode={layoutMode}
        presenting={readerMode === "presentation"}
        pointerActive={readerMode === "presentation" && laserPointerActive}
        rotation={rs.rotation}
        flipVertical={rs.flipVertical}
        appearance={settings.pdfAppearance}
        activeTool={activeTool}
        pendingColor={pendingColor}
        onPendingColorChange={setPendingColor}
        search={{
          query: searchState.query,
          caseSensitive: searchState.options.caseSensitive,
          wholeWord: searchState.options.wholeWord,
          activePage: searchState.matches[searchState.activeIndex]?.page ?? null,
          activeOrdinalOnPage:
            searchState.matches.length > 0
              ? searchState.matchesByPage
                  .get(searchState.matches[searchState.activeIndex]?.page ?? -1)
                  ?.indexOf(searchState.matches[searchState.activeIndex]) ?? null
              : null,
        }}
        onCreateAnnotation={handleCreateAnnotation}
        onAnnotationSelect={(a) => readerMode !== "presentation" && setEditingAnnotationId(a.id)}
        onCopy={handleCopy}
        onQuote={handleQuoteCopy}
        onCite={handleCite}
        onAddToNotes={handleAddToNotes}
        onInternalLink={handleInternalLink}
        form={profile.form}
        touch={profile.touch}
        pageAnimation={pageAnimation}
        edgeTaps={settings.edgeTaps}
        initialOffset={resume?.offset ?? 0}
        onPositionChange={handlePositionChange}
        onCenterTap={touchLayout ? onCenterTap : undefined}
        onSelectionActiveChange={setSelectionActive}
      />
    ) : null;

  const researchPanel = (variant: "panel" | "embedded") =>
    metadata && (
      <RightResearchPanel
        activeTab={rs.rightPanelTab}
        onTabChange={(t: RightTab) => patchReadingState({ rightPanelTab: t })}
        variant={variant}
        open={rightOpen}
        onOpenTab={(t: RightTab) => openRight(t)}
        width={rs.rightPanelWidth}
        onWidthChange={(w) => patchReadingState({ rightPanelWidth: w })}
        onClose={closeRight}
        documentTitle={metadata.title ?? metadata.fileName}
        annotations={data.annotations}
        onNavigate={(p) => {
          goToPage(p);
          if (touchLayout) setSheet(null);
        }}
        onSelectAnnotation={(a) => {
          if (touchLayout) setSheet(null);
          setEditingAnnotationId(a.id);
        }}
        notes={data.notes}
        onCreateNote={handleCreateNote}
        onUpdateNote={(id, patch) => dispatch({ type: "note/update", id, patch })}
        onDeleteNote={(id) => dispatch({ type: "note/delete", id })}
        pendingQuote={pendingQuote}
        onConsumePendingQuote={() => setPendingQuote(null)}
        annotationsById={annotationsById}
        citationFields={data.citationFields}
        onCitationFieldsChange={(patch) => dispatch({ type: "citation/patch", patch })}
        savedCitations={data.savedCitations}
        onDeleteCitation={(id) => dispatch({ type: "citationReference/delete", id })}
        metadata={metadata}
      />
    );

  const searchProps = {
    query: searchState.query,
    options: searchState.options,
    onOptionsChange: searchState.setOptions,
    matches: searchState.matches,
    activeIndex: searchState.activeIndex,
    onActiveIndexChange: searchState.setActiveIndex,
    searching: searchState.searching,
    noTextLayer: searchState.noTextLayer,
    onSearch: searchState.runSearch,
  };

  // Notices float above whatever controls are showing.
  const bannerStyle = touchLayout ? { bottom: `calc(var(--sab) + ${chromeShown ? 126 : 20}px)` } : undefined;
  const banners = (
    <>
      {notice ? (
        <FloatingBanner message={notice} actionLabel="OK" style={bannerStyle} onAction={() => setNotice(null)} onDismiss={() => setNotice(null)} />
      ) : loadError && !loadErrorDismissed ? (
        <FloatingBanner
          message={loadError}
          actionLabel="Reload"
          style={bannerStyle}
          onAction={() => window.location.reload()}
          onDismiss={() => setLoadErrorDismissed(true)}
        />
      ) : undoToast && !editingAnnotationId ? (
        <FloatingBanner
          key={undoToast.id}
          message={undoToast.label}
          actionLabel="Undo"
          style={bannerStyle}
          onAction={() => {
            annotationHistory.undo();
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      ) : resumeBanner ? (
        <FloatingBanner
          message={`Resumed at page ${resumeBanner}`}
          actionLabel="Start over"
          style={bannerStyle}
          onAction={startOver}
          onDismiss={() => setResumeBanner(null)}
        />
      ) : (
        navHistory.jumpOrigin !== null && (
          <FloatingBanner
            message="Followed a link in the document."
            actionLabel={`Return to page ${navHistory.jumpOrigin}`}
            style={bannerStyle}
            onAction={navHistory.goBack}
            onDismiss={navHistory.dismissJumpBanner}
          />
        )
      )}
    </>
  );

  const dialogs = (
    <>
      {commandPaletteOpen && <CommandPalette commands={commands} onClose={() => setCommandPaletteOpen(false)} onGoToPage={goToPage} />}
      {shortcutsOpen && <KeyboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {settingsOpen && (
        <ReaderSettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          onOpenShortcuts={() => {
            setSettingsOpen(false);
            setShortcutsOpen(true);
          }}
          showAnnotations={showAnnotations}
          onToggleShowAnnotations={() => setShowAnnotations((v) => !v)}
          onApplyZoomMode={(m) => patchReadingState({ zoomMode: m })}
          touch={touchLayout}
        />
      )}
      {infoOpen && metadata && <InfoModal metadata={metadata} onClose={() => setInfoOpen(false)} />}
      {citationTarget && (
        <CitationDialog
          page={citationTarget.page}
          text={citationTarget.text}
          fields={data.citationFields}
          onClose={() => setCitationTarget(null)}
          onSaveToNotes={(content) => {
            const id = handleCreateNote();
            dispatch({ type: "note/update", id, patch: { body: content } });
          }}
          onSaveReference={(style) => {
            if (!documentId) return;
            dispatch({
              type: "citationReference/add",
              citation: {
                id: crypto.randomUUID(),
                documentId,
                page: citationTarget.page,
                text: citationTarget.text,
                style,
                createdAt: new Date().toISOString(),
              },
            });
          }}
        />
      )}
      {editingAnnotationId &&
        annotationsById.has(editingAnnotationId) &&
        (() => {
          const annotation = annotationsById.get(editingAnnotationId)!;
          return (
            <AnnotationEditor
              annotation={annotation}
              onUpdate={(patch) => annotationHistory.record({ type: "annotation/update", id: annotation.id, patch })}
              onDelete={() => {
                annotationHistory.record({ type: "annotation/delete", id: annotation.id });
                setEditingAnnotationId(null);
              }}
              onAddToNotes={
                annotation.selectedText
                  ? () => {
                      handleAddToNotes(annotation.page, annotation.selectedText!, annotation.id);
                      setEditingAnnotationId(null);
                    }
                  : undefined
              }
              onClose={() => setEditingAnnotationId(null)}
            />
          );
        })()}
    </>
  );

  const statusViews = (
    <>
      {status === "loading" && <DocumentLoadingState />}
      {status === "error" && <DocumentErrorState message={error ?? "Something went wrong."} onRetry={retry} />}
      {status === "password-required" && <PasswordPrompt onSubmit={submitPassword} />}
    </>
  );

  // ============================ touch reader ================================
  if (touchLayout) {
    const toolArmed = activeTool !== "select" && activeTool !== "pan";
    return (
      <RootFrame dark={effectiveTheme === "dark"}>
      <div className="h-app fixed inset-0 overflow-hidden bg-background-secondary" data-form={profile.form}>
        {statusViews}
        {loaded && pdf && metadata && (
          <>
            <div className="absolute inset-0">{viewport}</div>

            {searchActive ? (
              <>
                <TouchSearchBar query={searchState.query} searching={searchState.searching} onSubmit={searchState.runSearch} onClose={closeTouchSearch} />
                <TouchSearchControls
                  query={searchState.query}
                  total={searchState.matches.length}
                  activeIndex={searchState.activeIndex}
                  searching={searchState.searching}
                  onStep={stepSearch}
                  onOpenResults={() => {
                    setNavTab("search");
                    setSheet("nav");
                  }}
                />
              </>
            ) : (
              <div onPointerDownCapture={bumpChrome}>
                <TouchTopBar
                  visible={chromeShown && !toolArmed}
                  title={metadata.title ?? metadata.fileName}
                  chapter={chapterFor(outline, currentPage)}
                  bookmarked={data.bookmarks.some((b) => b.page === currentPage)}
                  onExit={exitDocument}
                  onToggleBookmark={handleAddBookmark}
                  onSearch={startTouchSearch}
                  onMore={() => setSheet("more")}
                />
                <TouchBottomBar
                  visible={chromeShown && !toolArmed}
                  page={currentPage}
                  numPages={metadata.pageCount}
                  onSeek={goToPage}
                  onStep={pageTurnMode ? (d) => viewportRef.current?.stepPage(d) : undefined}
                  readingMode={settings.readingMode}
                  onToggleReadingMode={() => setLayoutChoice(settings.readingMode === "scroll" ? "single" : "continuous")}
                  zoomPercent={Math.round(liveScale * 100)}
                  onOpenZoom={() => setSheet("zoom")}
                  onOpenContents={() => {
                    setNavTab("contents");
                    setSheet("nav");
                  }}
                  onOpenAnnotations={() => openRight("annotations")}
                  onOpenDisplay={() => setSettingsOpen(true)}
                  onScrubbingChange={setScrubbing}
                  pdf={pdf}
                  pageAspect={pageAspect}
                  rotation={rs.rotation}
                  flipVertical={rs.flipVertical}
                  chapterOf={(p) => chapterFor(outline, p)}
                />
              </div>
            )}

            {toolArmed && (
              <ToolPill
                tool={activeTool}
                color={pendingColor}
                onColor={setPendingColor}
                canUndo={annotationHistory.canUndo}
                onUndo={annotationHistory.undo}
                onDone={() => setActiveTool("select")}
                top={`calc(var(--sat) + 10px)`}
              />
            )}
            {banners}

            {sheet === "nav" && (
              <NavigationSheet
                tab={navTab}
                onTab={setNavTab}
                onClose={() => setSheet(null)}
                pdf={pdf}
                numPages={metadata.pageCount}
                currentPage={currentPage}
                rotation={rs.rotation}
                flipVertical={rs.flipVertical}
                outline={outline}
                bookmarks={data.bookmarks}
                onNavigate={goToPage}
                onAddBookmark={handleAddBookmark}
                onUpdateBookmark={(id, patch) => dispatch({ type: "bookmark/update", id, patch })}
                onDeleteBookmark={(id) => dispatch({ type: "bookmark/delete", id })}
                search={searchProps}
              />
            )}
            {sheet === "more" && (
              <MoreSheet
                onClose={() => setSheet(null)}
                onInfo={() => setInfoOpen(true)}
                onCitation={() => openRight("references")}
                onSettings={() => setSettingsOpen(true)}
                onDownload={perms.download ? handleDownload : undefined}
                onPrint={perms.print ? handlePrint : undefined}
                onFullscreen={toggleFullscreen}
                fullscreenSupported={!!document.fullscreenEnabled}
                isFullscreen={isFullscreen}
                canUndo={annotationHistory.canUndo}
                canRedo={annotationHistory.canRedo}
                onUndo={annotationHistory.undo}
                onRedo={annotationHistory.redo}
                annotationsVisible={showAnnotations}
                onToggleAnnotations={() => setShowAnnotations((v) => !v)}
                onExit={exitDocument}
                onTool={(t) => {
                  setActiveTool(t);
                  setChromeVisible(false);
                }}
              />
            )}
            {sheet === "zoom" && (
              <ZoomSheet
                onClose={() => setSheet(null)}
                percent={Math.round(liveScale * 100)}
                zoomMode={rs.zoomMode}
                onPreset={applyZoomPreset}
                onStep={stepZoom}
              />
            )}
            {sheet === "research" && (
              <BottomSheet title="Annotations & research" onClose={() => setSheet(null)} size="fill" padded={false}>
                {researchPanel("embedded")}
              </BottomSheet>
            )}
          </>
        )}
        {dialogs}
      </div>
      </RootFrame>
    );
  }

  // ============================ desktop reader ==============================
  return (
    <RootFrame dark={effectiveTheme === "dark"}>
    <div className="h-app flex flex-col bg-background">
      {readerMode !== "presentation" && (
        <ReaderHeader
          title={metadata?.title ?? metadata?.fileName ?? "Untitled document"}
          author={metadata?.author ?? null}
          currentPage={currentPage}
          numPages={metadata?.pageCount ?? null}
          onJumpToPage={goToPage}
          canGoBack={navHistory.canGoBack}
          canGoForward={navHistory.canGoForward}
          onGoBack={navHistory.goBack}
          onGoForward={navHistory.goForward}
          onOpenSearch={() => openLeft("search")}
          onOpenLeftSidebar={() => openLeft()}
          readerMode={readerMode}
          onSetReaderMode={setReaderMode}
          theme={effectiveTheme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenInfo={() => setInfoOpen(true)}
          onExportAnnotations={() => openRight("annotations")}
          onDownload={perms.download ? handleDownload : undefined}
          onPrint={perms.print ? handlePrint : undefined}
          onBack={exitDocument}
          saveStatus={saveStatus}
          rightPanelOpen={rightOpen}
          onToggleRightPanel={toggleRight}
          compact={false}
        />
      )}

      {statusViews}

      {loaded && pdf && metadata && (
        <>
          {readerMode === "standard" && (
            <ReaderToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              color={pendingColor}
              onColorChange={setPendingColor}
              layoutMode={readingLayout}
              onLayoutModeChange={setLayoutChoice}
              zoomMode={rs.zoomMode}
              scale={liveScale}
              onSetZoomMode={(m) => patchReadingState({ zoomMode: m })}
              onZoomIn={() => stepZoom(0.1)}
              onZoomOut={() => stepZoom(-0.1)}
              onRotateCW={() => patchReadingState({ rotation: (((rs.rotation + 90) % 360) as 0 | 90 | 180 | 270) })}
              onRotateCCW={() => patchReadingState({ rotation: (((rs.rotation + 270) % 360) as 0 | 90 | 180 | 270) })}
              flipVertical={rs.flipVertical}
              onToggleFlipVertical={() => patchReadingState({ flipVertical: !rs.flipVertical })}
              bookmarked={data.bookmarks.some((b) => b.page === currentPage)}
              onBookmark={handleAddBookmark}
              onCopySelection={() => handleCopy(window.getSelection()?.toString() ?? "")}
              canUndo={annotationHistory.canUndo}
              canRedo={annotationHistory.canRedo}
              onUndo={annotationHistory.undo}
              onRedo={annotationHistory.redo}
              compact={false}
            />
          )}

          <div className="flex min-h-0 flex-1">
            {readerMode === "standard" && (
              <LeftSidebar
                open={leftOpen}
                variant="panel"
                canDock={false}
                docked={false}
                activeTab={rs.leftSidebarTab}
                onTabChange={(t: LeftTab) => patchReadingState({ leftSidebarTab: t })}
                onToggleOpen={toggleLeft}
                pdf={pdf}
                numPages={metadata.pageCount}
                currentPage={currentPage}
                rotation={rs.rotation}
                flipVertical={rs.flipVertical}
                onNavigate={goToPage}
                outline={outline}
                bookmarks={data.bookmarks}
                onAddBookmark={handleAddBookmark}
                onUpdateBookmark={(id, patch) => dispatch({ type: "bookmark/update", id, patch })}
                onDeleteBookmark={(id) => dispatch({ type: "bookmark/delete", id })}
                search={searchProps}
              />
            )}

            <div className="relative min-w-0 flex-1">
              {viewport}
              {banners}
              {readerMode === "focus" && (
                <FocusControlBar
                  currentPage={currentPage}
                  numPages={metadata.pageCount}
                  onPrev={() => viewportRef.current?.stepPage(-1)}
                  onNext={() => viewportRef.current?.stepPage(1)}
                  scale={liveScale}
                  onZoomIn={() => stepZoom(0.1)}
                  onZoomOut={() => stepZoom(-0.1)}
                  annotationsVisible={showAnnotations}
                  onToggleAnnotations={() => setShowAnnotations((v) => !v)}
                  onExit={() => setReaderMode("standard")}
                />
              )}
              {readerMode === "presentation" && (
                <PresentationControls
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  color={pendingColor}
                  onColorChange={setPendingColor}
                  pointerActive={laserPointerActive}
                  onTogglePointer={() => setLaserPointerActive((v) => !v)}
                  onExit={() => setReaderMode("standard")}
                />
              )}
              {readerMode === "presentation" && (
                <PresentationPageChanger currentPage={currentPage} numPages={metadata.pageCount} onNavigate={goToPage} />
              )}
            </div>

            {readerMode === "standard" && researchPanel("panel")}
          </div>
        </>
      )}

      {dialogs}
    </div>
    </RootFrame>
  );
}

/**
 * The reader is a full-viewport layer over the site chrome (header, footer),
 * not a page inside it. `reader-root` is also what scopes the reader's dark
 * theme and text-layer CSS to this subtree (see globals.css / reader.css).
 */
function RootFrame({ dark, children }: { dark: boolean; children: React.ReactNode }) {
  // The page underneath must not scroll behind the reader.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className={`reader-root fixed inset-0 z-50 overflow-hidden bg-background text-text-primary${dark ? " dark" : ""}`}>{children}</div>
  );
}

function InfoModal({ metadata, onClose }: { metadata: DocumentMetadata; onClose: () => void }) {
  return (
    <Modal title="Document information" onClose={onClose} width={420}>
      <DocumentInfoPanel metadata={metadata} />
    </Modal>
  );
}
