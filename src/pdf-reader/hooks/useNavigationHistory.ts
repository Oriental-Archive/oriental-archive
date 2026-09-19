import { useCallback, useRef, useState } from "react";

// Tracks reading position history so following a footnote/cross-reference
// link can be undone with "Return to page N", and so header back/forward
// controls work like browser history. Session-only by design (this is
// where-you've-been, not a persisted bookmark).
export function useNavigationHistory(onNavigate: (page: number) => void) {
  const [back, setBack] = useState<number[]>([]);
  const [forward, setForward] = useState<number[]>([]);
  const [jumpOrigin, setJumpOrigin] = useState<number | null>(null);
  const currentPageRef = useRef(1);

  const recordCurrentPage = useCallback((page: number) => {
    currentPageRef.current = page;
  }, []);

  /** Call before navigating away from `currentPage` to a linked destination. */
  const pushJump = useCallback((fromPage: number) => {
    setBack((b) => [...b, fromPage]);
    setForward([]);
    setJumpOrigin(fromPage);
  }, []);

  const goBack = useCallback(() => {
    setBack((b) => {
      if (b.length === 0) return b;
      const prev = b[b.length - 1];
      setForward((f) => [...f, currentPageRef.current]);
      onNavigate(prev);
      return b.slice(0, -1);
    });
    setJumpOrigin(null);
  }, [onNavigate]);

  const goForward = useCallback(() => {
    setForward((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setBack((b) => [...b, currentPageRef.current]);
      onNavigate(next);
      return f.slice(0, -1);
    });
  }, [onNavigate]);

  const dismissJumpBanner = useCallback(() => setJumpOrigin(null), []);

  return {
    canGoBack: back.length > 0,
    canGoForward: forward.length > 0,
    jumpOrigin,
    recordCurrentPage,
    pushJump,
    goBack,
    goForward,
    dismissJumpBanner,
  };
}
