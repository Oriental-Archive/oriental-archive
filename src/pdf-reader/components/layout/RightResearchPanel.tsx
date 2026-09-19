import { useRef } from "react";
import { Highlighter, NotebookText, BookMarked, Info, PanelRightClose, Pin, PinOff } from "lucide-react";
import type { Annotation, CitationFields, DocumentMetadata, ResearchNote, SavedCitation } from "@/pdf-reader/types";
import { AnnotationPanel } from "@/pdf-reader/components/layout/AnnotationPanel";
import { ResearchNotesPanel } from "@/pdf-reader/components/layout/ResearchNotesPanel";
import { ReferencesPanel } from "@/pdf-reader/components/layout/ReferencesPanel";
import { DocumentInfoPanel } from "@/pdf-reader/components/layout/DocumentInfoPanel";
import { Tooltip } from "@/pdf-reader/components/common/Tooltip";

export type RightTab = "annotations" | "notes" | "references" | "info";

const TABS: { id: RightTab; label: string; icon: React.ReactNode }[] = [
  { id: "annotations", label: "Annotations", icon: <Highlighter size={15} /> },
  { id: "notes", label: "Notes", icon: <NotebookText size={15} /> },
  { id: "references", label: "References", icon: <BookMarked size={15} /> },
  { id: "info", label: "Info", icon: <Info size={15} /> },
];

export function RightResearchPanel({
  activeTab,
  onTabChange,
  variant = "panel",
  open = true,
  onOpenTab,
  width,
  onWidthChange,
  onClose,
  documentTitle,
  annotations,
  onNavigate,
  onSelectAnnotation,
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  pendingQuote,
  onConsumePendingQuote,
  annotationsById,
  citationFields,
  onCitationFieldsChange,
  savedCitations,
  onDeleteCitation,
  metadata,
  canDock = false,
  docked = false,
  onToggleDock,
}: {
  activeTab: RightTab;
  onTabChange: (t: RightTab) => void;
  /** "panel" only: false collapses it to a slim rail of tab icons (like the left sidebar) instead of removing it. */
  open?: boolean;
  /** Called with the tab whose rail icon was clicked, to expand the panel onto it. */
  onOpenTab?: (t: RightTab) => void;
  /** "panel" (resizable, pushes viewport, desktop), "drawer" (right overlay, tablet), "sheet" (bottom overlay, mobile). */
  variant?: "panel" | "drawer" | "sheet" | "embedded";
  /** Below the desktop breakpoint, lets the user pin this drawer/sheet open as a permanent panel instead. */
  canDock?: boolean;
  docked?: boolean;
  onToggleDock?: () => void;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  documentTitle: string;
  annotations: Annotation[];
  onNavigate: (page: number) => void;
  onSelectAnnotation: (a: Annotation) => void;
  notes: ResearchNote[];
  onCreateNote: () => string;
  onUpdateNote: (id: string, patch: Partial<ResearchNote>) => void;
  onDeleteNote: (id: string) => void;
  pendingQuote: { page: number; text: string; annotationId: string | null } | null;
  onConsumePendingQuote: () => void;
  annotationsById: Map<string, Annotation>;
  citationFields: CitationFields;
  onCitationFieldsChange: (patch: Partial<CitationFields>) => void;
  savedCitations: SavedCitation[];
  onDeleteCitation: (id: string) => void;
  metadata: DocumentMetadata | null;
}) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  if (variant === "panel" && !open) {
    return (
      <nav aria-label="Research panel" className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-border bg-surface py-2">
        {TABS.map((tab) => (
          <Tooltip key={tab.id} label={tab.label}>
            <button
              type="button"
              onClick={() => onOpenTab?.(tab.id)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
            >
              {tab.icon}
            </button>
          </Tooltip>
        ))}
      </nav>
    );
  }

  function onResizeStart(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startWidth: width };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      onWidthChange(Math.min(560, Math.max(280, dragRef.current.startWidth + delta)));
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const body = (
    <div
      className={
        // relative+z-10 matters here: the backdrop below is `absolute`, and
        // a positioned element always paints above a non-positioned sibling
        // regardless of DOM order — without this the backdrop covered the
        // panel (looked "greyed out") and ate every click, bouncing straight
        // back to the PDF.
        variant === "sheet"
          ? "relative z-10 flex h-[78vh] w-full flex-col rounded-t-xl border-t border-border bg-surface shadow-xl"
          : variant === "drawer"
            ? "relative z-10 flex h-full w-[85vw] max-w-sm flex-col border-l border-border bg-surface shadow-xl"
            : variant === "embedded"
              ? "flex h-full min-w-0 flex-col"
              : "flex min-w-0 flex-1 flex-col"
      }
    >
      {variant === "sheet" && (
        <button type="button" onClick={onClose} aria-label="Close panel" className="flex shrink-0 justify-center py-2">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </button>
      )}
      <div className="flex items-center border-b border-border pr-1">
        <div role="tablist" className="flex flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-2.5 text-[10.5px] font-medium transition-colors [@media(pointer:coarse)]:py-3 ${
                activeTab === tab.id ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {canDock && (
          <Tooltip label={docked ? "Undock (overlay when collapsed)" : "Dock (keep visible alongside the page)"}>
            <button
              type="button"
              onClick={onToggleDock}
              aria-pressed={docked}
              className={`flex h-7 w-7 items-center justify-center rounded-md [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 ${
                docked ? "text-accent" : "text-text-muted hover:bg-surface-hover"
              }`}
            >
              {docked ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          </Tooltip>
        )}
        {variant !== "sheet" && variant !== "embedded" && (
          <Tooltip label="Collapse panel" shortcut="Mod+Shift+R">
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10"
            >
              <PanelRightClose size={15} />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "annotations" && (
          <AnnotationPanel annotations={annotations} onNavigate={onNavigate} onSelect={onSelectAnnotation} documentTitle={documentTitle} />
        )}
        {activeTab === "notes" && (
          <ResearchNotesPanel
            notes={notes}
            onCreate={onCreateNote}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
            pendingQuote={pendingQuote}
            onConsumePendingQuote={onConsumePendingQuote}
            onNavigate={onNavigate}
            annotationsById={annotationsById}
          />
        )}
        {activeTab === "references" && (
          <ReferencesPanel
            fields={citationFields}
            onChange={onCitationFieldsChange}
            savedCitations={savedCitations}
            onNavigate={onNavigate}
            onDeleteCitation={onDeleteCitation}
          />
        )}
        {activeTab === "info" && metadata && <DocumentInfoPanel metadata={metadata} />}
      </div>
    </div>
  );

  if (variant === "embedded") return body;
  if (variant === "sheet") {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        {body}
      </div>
    );
  }
  if (variant === "drawer") {
    return (
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        {body}
      </div>
    );
  }

  return (
    <div className="relative flex shrink-0 border-l border-border bg-surface" style={{ width }}>
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 -left-1 h-full w-2 cursor-col-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize research panel"
      />
      {body}
    </div>
  );
}
