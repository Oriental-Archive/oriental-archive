import { useEffect } from "react";
import { isEditableTarget, matchesShortcut, SHORTCUTS, type ShortcutId } from "@/pdf-reader/lib/shortcuts";

export function useKeyboardShortcuts(handlers: Partial<Record<ShortcutId, (e: KeyboardEvent) => void>>) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape must still work inside inputs (e.g. to cancel an annotation
      // editor); every other shortcut yields to normal typing.
      if (isEditableTarget(e.target) && e.key !== "Escape") return;
      for (const def of SHORTCUTS) {
        const handler = handlers[def.id];
        if (handler && matchesShortcut(e, def.keys)) {
          e.preventDefault();
          handler(e);
          return;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers]);
}
