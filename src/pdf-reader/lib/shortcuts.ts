// Central shortcut registry: definitions (id, key combo, label) are kept
// separate from what they do, so remapping or making shortcuts user-configurable
// later only means changing this table, not the components that fire actions.

export type ShortcutId =
  | "search"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "bookmark"
  | "highlightMode"
  | "newNote"
  | "escape"
  | "nextPage"
  | "prevPage"
  | "firstPage"
  | "lastPage"
  | "commandPalette"
  | "toggleLeftSidebar"
  | "toggleRightPanel"
  | "focusMode"
  | "undo"
  | "redo"
  | "drawMode"
  | "laserPointer"
  | "presentationNextPage"
  | "presentationPrevPage";

export type ShortcutDef = { id: ShortcutId; keys: string; label: string };

export const SHORTCUTS: ShortcutDef[] = [
  { id: "commandPalette", keys: "Mod+K", label: "Open command palette" },
  { id: "search", keys: "Mod+F", label: "Search document" },
  { id: "zoomIn", keys: "Mod+=", label: "Zoom in" },
  { id: "zoomOut", keys: "Mod+-", label: "Zoom out" },
  { id: "zoomReset", keys: "Mod+0", label: "Fit / reset zoom" },
  { id: "bookmark", keys: "B", label: "Bookmark current page" },
  { id: "highlightMode", keys: "H", label: "Highlight tool" },
  { id: "newNote", keys: "N", label: "New note" },
  { id: "escape", keys: "Escape", label: "Exit active tool" },
  { id: "nextPage", keys: "PageDown", label: "Next page" },
  { id: "prevPage", keys: "PageUp", label: "Previous page" },
  { id: "firstPage", keys: "Home", label: "First page" },
  { id: "lastPage", keys: "End", label: "Last page" },
  { id: "toggleLeftSidebar", keys: "Mod+Shift+L", label: "Toggle left sidebar" },
  { id: "toggleRightPanel", keys: "Mod+Shift+R", label: "Toggle right panel" },
  { id: "focusMode", keys: "Mod+Shift+F", label: "Toggle focus mode" },
  { id: "undo", keys: "Mod+Z", label: "Undo" },
  { id: "redo", keys: "Mod+Shift+Z", label: "Redo" },
  { id: "drawMode", keys: "D", label: "Freehand pen tool" },
  { id: "laserPointer", keys: "L", label: "Toggle laser pointer (presentation)" },
  { id: "presentationNextPage", keys: "ArrowRight", label: "Next page (presentation)" },
  { id: "presentationPrevPage", keys: "ArrowLeft", label: "Previous page (presentation)" },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function shortcutKeyLabel(keys: string): string {
  return keys.replace("Mod", isMac ? "⌘" : "Ctrl");
}

export function matchesShortcut(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split("+");
  const key = parts[parts.length - 1];
  const needsMod = parts.includes("Mod");
  const needsShift = parts.includes("Shift");
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (needsMod && !mod) return false;
  if (!needsMod && mod) return false;
  if (needsShift !== e.shiftKey) return false;

  const pressed = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const wanted = key.length === 1 ? key.toUpperCase() : key;
  if (wanted === "=" && (e.key === "=" || e.key === "+")) return true;
  return pressed === wanted;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
