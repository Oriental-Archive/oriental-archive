import { useCallback, useMemo, useRef, useState } from "react";

export type PageSize = { width: number; height: number };
export type PageRect = { top: number; height: number; width: number };

const FALLBACK_SIZE: PageSize = { width: 612, height: 792 }; // US Letter at 72dpi, pre-scale

/**
 * Tracks each page's natural (scale=1) size as PdfPage reports it. Kept
 * separate from the scale-dependent offset math in usePageLayout below so
 * both "what scale should fit-width use" and "where does page N sit in the
 * scroll" read from the same learned sizes instead of two independent,
 * possibly-inconsistent copies.
 */
export function useNaturalSizes() {
  const sizesRef = useRef<Map<number, PageSize>>(new Map());
  const [version, setVersion] = useState(0);

  const setNaturalSize = useCallback((page: number, size: PageSize) => {
    const existing = sizesRef.current.get(page);
    if (existing && existing.width === size.width && existing.height === size.height) return;
    sizesRef.current.set(page, size);
    setVersion((v) => v + 1);
  }, []);

  const referenceSize = useMemo<PageSize>(() => {
    return sizesRef.current.get(1) ?? sizesRef.current.values().next().value ?? FALLBACK_SIZE;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const getSize = useCallback((page: number): PageSize => sizesRef.current.get(page) ?? referenceSize, [referenceSize]);

  return { sizesRef, version, referenceSize, setNaturalSize, getSize };
}

/**
 * Lays out pages for continuous virtualized scrolling without requiring a
 * full pass over the document up front: pages not yet measured use the
 * reference size as an estimate (documents are overwhelmingly uniform
 * page-to-page, so this rarely causes visible reflow — a real mismatch just
 * nudges the scrollbar slightly once that page is measured).
 */
export function usePageLayout(numPages: number, scale: number, gap: number, natural: ReturnType<typeof useNaturalSizes>) {
  const { sizesRef, version, referenceSize } = natural;

  const { tops, totalHeight, maxPageWidth } = useMemo(() => {
    const tops: number[] = [];
    let cumulative = 0;
    let maxPageWidth = referenceSize.width * scale;
    for (let p = 1; p <= numPages; p++) {
      tops.push(cumulative);
      const size = sizesRef.current.get(p) ?? referenceSize;
      cumulative += size.height * scale + gap;
      if (size.width * scale > maxPageWidth) maxPageWidth = size.width * scale;
    }
    return { tops, totalHeight: cumulative, maxPageWidth };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, scale, gap, referenceSize, version]);

  const getPageRect = useCallback(
    (page: number): PageRect => {
      const size = sizesRef.current.get(page) ?? referenceSize;
      return { top: tops[page - 1] ?? 0, height: size.height * scale, width: size.width * scale };
    },
    [tops, referenceSize, scale, sizesRef]
  );

  /** Binary search: the last page whose top offset is <= y. */
  const pageAtOffset = useCallback(
    (y: number): number => {
      let lo = 0;
      let hi = tops.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (tops[mid] <= y) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
    [tops]
  );

  return { getPageRect, pageAtOffset, totalHeight, maxPageWidth };
}
