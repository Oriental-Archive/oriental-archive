import { useMemo } from "react";
import type { ZoomMode } from "@/pdf-reader/types";
import type { PageSize } from "@/pdf-reader/hooks/usePageLayout";

/** Breathing room around the page inside the viewport. Phones give almost all of it back — the page is the interface. */
export const PAGE_PADDING = { phone: 8, tablet: 24, desktop: 48 } as const;

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 6;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * `columns` is how many pages sit side by side (2 for a spread), so "fit
 * width" fits the whole spread rather than a single page inside it.
 */
export function useFitScale(
  zoomMode: ZoomMode,
  zoomLevel: number,
  referenceSize: PageSize,
  containerSize: { width: number; height: number },
  padding: number = PAGE_PADDING.desktop,
  columns = 1
): number {
  return useMemo(() => {
    if (zoomMode === "custom") return zoomLevel;
    if (zoomMode === "actual-size") return 1;
    if (!containerSize.width || !referenceSize.width) return zoomLevel || 1;

    const availableWidth = containerSize.width - padding;
    const contentWidth = referenceSize.width * columns;
    if (zoomMode === "fit-width") return Math.max(0.1, availableWidth / contentWidth);

    const availableHeight = containerSize.height - padding;
    return Math.max(0.1, Math.min(availableWidth / contentWidth, availableHeight / referenceSize.height));
  }, [zoomMode, zoomLevel, referenceSize, containerSize, padding, columns]);
}
