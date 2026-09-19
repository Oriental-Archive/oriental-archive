import { Undo2 } from "lucide-react";
import type { HighlightColor, ToolId } from "@/pdf-reader/types";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

const LABELS: Partial<Record<ToolId, string>> = {
  highlight: "Highlighter",
  underline: "Underline",
  strikethrough: "Strikethrough",
  draw: "Pen",
  note: "Note pins",
  comment: "Note pins",
  area: "Area box",
};

/**
 * While a drawing/marking tool is armed the chrome is hidden and a finger
 * belongs to the tool, so the one thing that must stay reachable is "I'm
 * done": a compact pill with the color, undo, and Done.
 */
export function ToolPill({
  tool,
  color,
  onColor,
  canUndo,
  onUndo,
  onDone,
  top,
}: {
  tool: ToolId;
  color: HighlightColor;
  onColor: (c: HighlightColor) => void;
  canUndo: boolean;
  onUndo: () => void;
  onDone: () => void;
  top: string;
}) {
  return (
    <div
      data-no-gesture=""
      className="pointer-events-auto absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface-elevated/95 py-1 pr-1 pl-3 shadow-md backdrop-blur transition-[top] duration-200"
      style={{ top }}
    >
      <span className="mr-1 text-[12px] font-medium text-text-secondary">{LABELS[tool] ?? tool}</span>
      {COLORS.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => onColor(c)} className="flex h-9 w-7 items-center justify-center">
          <span
            className="block h-4 w-4 rounded-full"
            style={{ background: HIGHLIGHT_COLOR_VARS[c], outline: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)", outlineOffset: 1 }}
          />
        </button>
      ))}
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary disabled:opacity-30"
      >
        <Undo2 size={16} />
      </button>
      <button type="button" onClick={onDone} className="h-9 rounded-full bg-accent px-4 text-[12px] font-medium text-background">
        Done
      </button>
    </div>
  );
}
