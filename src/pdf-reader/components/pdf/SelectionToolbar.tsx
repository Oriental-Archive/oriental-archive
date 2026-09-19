import { useState } from "react";
import { Highlighter, Underline, Strikethrough, StickyNote, Copy, Quote, BookMarked, FolderPlus, MoreHorizontal } from "lucide-react";
import type { HighlightColor, PendingSelection } from "@/pdf-reader/types";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";
import { Tooltip } from "@/pdf-reader/components/common/Tooltip";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

type Panel = "colors" | "more" | null;

export type SelectionToolbarProps = {
  pending: PendingSelection;
  color: HighlightColor;
  /** Picking a color highlights with it right away and remembers it for next time. */
  onPickColor: (c: HighlightColor) => void;
  onHighlight: () => void;
  onUnderline: () => void;
  onStrikethrough: () => void;
  onAddNote: () => void;
  onCopy: () => void;
  onQuote: () => void;
  onCite: () => void;
  onAddToNotes: () => void;
  /** "floating" sits beside the selection (desktop/tablet); "bar" docks to the bottom for one-thumb use on phones. */
  variant?: "floating" | "bar";
  /** Touch: place the floating toolbar *below* the selection, since the OS's own copy/paste menu appears above it. */
  below?: boolean;
};

export function SelectionToolbar(props: SelectionToolbarProps) {
  const { pending, variant = "floating", below = false } = props;
  const [panel, setPanel] = useState<Panel>(null);
  const bar = variant === "bar";

  const shell = bar
    ? "pointer-events-auto fixed inset-x-0 z-40 border-t border-border bg-surface-elevated/97 backdrop-blur"
    : "pointer-events-auto absolute z-20 rounded-lg border border-border bg-surface-elevated shadow-md";

  const shellStyle = bar
    ? { bottom: "var(--kb)", paddingBottom: "var(--sab)", paddingLeft: "var(--sal)", paddingRight: "var(--sar)" }
    : {
        // Keep the toolbar inside narrow pages: clamp its center away from both edges.
        left: `clamp(130px, ${pending.anchor.x * 100}%, calc(100% - 130px))`,
        top: `${(below ? pending.anchor.bottom : pending.anchor.top) * 100}%`,
        transform: below ? "translate(-50%, 8px)" : "translate(-50%, calc(-100% - 8px))",
      };

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      data-selection-toolbar=""
      data-no-gesture=""
      className={`${shell} no-callout`}
      style={shellStyle}
      onMouseDown={(e) => e.preventDefault()}
    >
      {panel === "colors" && (
        <ColorRow
          color={props.color}
          bar={bar}
          onPick={(c) => {
            setPanel(null);
            props.onPickColor(c);
          }}
        />
      )}
      {panel === "more" && (
        <MoreMenu
          bar={bar}
          onStrikethrough={() => {
            setPanel(null);
            props.onStrikethrough();
          }}
          onQuote={() => {
            setPanel(null);
            props.onQuote();
          }}
          onAddToNotes={() => {
            setPanel(null);
            props.onAddToNotes();
          }}
        />
      )}
      <div className={bar ? "mx-auto flex max-w-xl items-stretch justify-between px-1 py-1" : "flex items-center gap-0.5 p-1"}>
        <ColorChip color={props.color} bar={bar} active={panel === "colors"} onClick={() => setPanel(panel === "colors" ? null : "colors")} />
        <Action label="Highlight" bar={bar} onClick={props.onHighlight}>
          <Highlighter size={bar ? 20 : 15} />
        </Action>
        <Action label="Underline" bar={bar} onClick={props.onUnderline}>
          <Underline size={bar ? 20 : 15} />
        </Action>
        <Action label="Note" bar={bar} onClick={props.onAddNote}>
          <StickyNote size={bar ? 20 : 15} />
        </Action>
        <Action label="Copy" bar={bar} onClick={props.onCopy}>
          <Copy size={bar ? 20 : 15} />
        </Action>
        <Action label="Cite" bar={bar} onClick={props.onCite}>
          <BookMarked size={bar ? 20 : 15} />
        </Action>
        <Action label="More" bar={bar} active={panel === "more"} onClick={() => setPanel(panel === "more" ? null : "more")}>
          <MoreHorizontal size={bar ? 20 : 15} />
        </Action>
      </div>
    </div>
  );
}

function ColorChip({ color, bar, active, onClick }: { color: HighlightColor; bar: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Highlight color: ${color}. Change color`}
      aria-expanded={active}
      className={`flex shrink-0 items-center justify-center rounded-md hover:bg-surface-hover ${bar ? "min-h-11 min-w-11 flex-1" : "h-7 w-7"}`}
    >
      <span
        className="block rounded-full"
        style={{
          width: bar ? 20 : 14,
          height: bar ? 20 : 14,
          background: HIGHLIGHT_COLOR_VARS[color],
          outline: active ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
          outlineOffset: 1,
        }}
      />
    </button>
  );
}

function ColorRow({ color, bar, onPick }: { color: HighlightColor; bar: boolean; onPick: (c: HighlightColor) => void }) {
  return (
    <div className={`flex items-center justify-center gap-3 border-border ${bar ? "border-b px-3 py-2" : "border-b px-2 py-1.5"}`}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={color === c}
          onClick={() => onPick(c)}
          className={`flex items-center justify-center ${bar ? "h-11 w-11" : "h-6 w-6"}`}
        >
          <span
            className="block rounded-full"
            style={{
              width: bar ? 26 : 16,
              height: bar ? 26 : 16,
              background: HIGHLIGHT_COLOR_VARS[c],
              outline: color === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
              outlineOffset: 2,
            }}
          />
        </button>
      ))}
    </div>
  );
}

function MoreMenu({
  bar,
  onStrikethrough,
  onQuote,
  onAddToNotes,
}: {
  bar: boolean;
  onStrikethrough: () => void;
  onQuote: () => void;
  onAddToNotes: () => void;
}) {
  const row = `flex w-full items-center gap-3 text-left text-text-secondary hover:bg-surface-hover ${bar ? "min-h-12 px-4 text-[14px]" : "px-3 py-1.5 text-xs"}`;
  const size = bar ? 18 : 14;
  return (
    <div className="border-b border-border py-1">
      <button type="button" onClick={onStrikethrough} className={row}>
        <Strikethrough size={size} /> Strikethrough
      </button>
      <button type="button" onClick={onQuote} className={row}>
        <Quote size={size} /> Copy as quote with page
      </button>
      <button type="button" onClick={onAddToNotes} className={row}>
        <FolderPlus size={size} /> Add to research notes
      </button>
    </div>
  );
}

function Action({
  label,
  bar,
  active,
  onClick,
  children,
}: {
  label: string;
  bar: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent ${
        bar ? "min-h-11 min-w-11 flex-1 flex-col gap-0.5" : "h-7 w-7"
      } ${active ? "bg-surface-hover text-text-primary" : ""}`}
    >
      {children}
      {bar && <span className="text-[10px] leading-none">{label}</span>}
    </button>
  );
  return bar ? button : <Tooltip label={label}>{button}</Tooltip>;
}
