import { MousePointer2, Highlighter, PenLine, Radar, X } from "lucide-react";
import type { HighlightColor, ToolId } from "@/pdf-reader/types";
import { IconButton } from "@/pdf-reader/components/common/IconButton";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

/**
 * Presentation mode hides the full toolbar so nothing reads as "still
 * editing" in front of an audience, but the highlighter, pen, and a laser
 * pointer are still genuinely useful for pointing something out live — this
 * is the minimal surface for reaching those three without bringing back the
 * rest of the chrome.
 */
export function PresentationControls({
  activeTool,
  onToolChange,
  color,
  onColorChange,
  pointerActive,
  onTogglePointer,
  onExit,
}: {
  activeTool: ToolId;
  onToolChange: (t: ToolId) => void;
  color: HighlightColor;
  onColorChange: (c: HighlightColor) => void;
  pointerActive: boolean;
  onTogglePointer: () => void;
  onExit: () => void;
}) {
  const showColors = !pointerActive && (activeTool === "highlight" || activeTool === "draw");

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full border border-border bg-surface-elevated/90 p-1 shadow-md backdrop-blur">
      <IconButton
        label="Select"
        size="sm"
        active={!pointerActive && activeTool === "select"}
        onClick={() => {
          onToolChange("select");
          if (pointerActive) onTogglePointer();
        }}
      >
        <MousePointer2 size={14} />
      </IconButton>
      <IconButton
        label="Highlight"
        shortcut="H"
        size="sm"
        active={!pointerActive && activeTool === "highlight"}
        onClick={() => {
          onToolChange("highlight");
          if (pointerActive) onTogglePointer();
        }}
      >
        <Highlighter size={14} />
      </IconButton>
      <IconButton
        label="Freehand pen"
        shortcut="D"
        size="sm"
        active={!pointerActive && activeTool === "draw"}
        onClick={() => {
          onToolChange("draw");
          if (pointerActive) onTogglePointer();
        }}
      >
        <PenLine size={14} />
      </IconButton>

      {showColors && (
        <div className="flex items-center gap-1 border-l border-border pl-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => onColorChange(c)}
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{
                background: HIGHLIGHT_COLOR_VARS[c],
                outline: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
                outlineOffset: 1,
              }}
            />
          ))}
        </div>
      )}

      <div className="border-l border-border pl-1">
        <IconButton label="Laser pointer" shortcut="L" size="sm" active={pointerActive} onClick={onTogglePointer}>
          <Radar size={14} />
        </IconButton>
      </div>

      <div className="ml-0.5 flex items-center gap-1 border-l border-border pl-1.5 pr-1.5">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <X size={13} />
          Exit
        </button>
      </div>
    </div>
  );
}
