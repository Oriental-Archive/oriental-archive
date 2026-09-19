import { useEffect, useState } from "react";
import type { Annotation } from "@/pdf-reader/types";
import type { DocumentAction } from "@/pdf-reader/lib/documentStore";

const HISTORY_LIMIT = 50;

/**
 * Undo/redo for annotations specifically — not bookmarks, notes, or reading
 * state — since "undo" for a reader means "I marked the wrong thing," not a
 * general time-travel of every preference. Snapshots the whole annotations
 * array around each mutating action rather than inverting individual
 * add/update/delete patches: simpler to get right, and "undo my last change"
 * only needs per-action granularity anyway.
 */
export function useAnnotationHistory(documentId: string | null, annotations: Annotation[], dispatch: (action: DocumentAction) => void) {
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  // A different document has nothing to do with this one's history.
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [documentId]);

  function record(action: DocumentAction) {
    if (action.type === "annotation/add" || action.type === "annotation/update" || action.type === "annotation/delete") {
      setUndoStack((s) => [...s.slice(-HISTORY_LIMIT + 1), annotations]);
      setRedoStack([]);
    }
    dispatch(action);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, annotations]);
    dispatch({ type: "annotations/replace", annotations: prev });
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((s) => [...s, annotations]);
    dispatch({ type: "annotations/replace", annotations: next });
  }

  return { record, undo, redo, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 };
}
