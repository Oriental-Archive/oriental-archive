import { useEffect, useState, type RefObject } from "react";

export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

let cachedScrollbarWidth: number | null = null;

/**
 * Width a classic (non-overlay) vertical scrollbar takes from a scroller: ~15px
 * on Windows/Linux desktops, 0 for the overlay scrollbars of macOS and touch
 * devices. Measured once, from a probe element.
 */
export function scrollbarWidth(): number {
  if (cachedScrollbarWidth === null) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll";
    document.body.appendChild(probe);
    cachedScrollbarWidth = probe.offsetWidth - probe.clientWidth;
    probe.remove();
    // At fractional display scaling (Windows at 125%/150%) the scrollbar is a
    // fractional number of CSS px (~15.33) but both measurements above are
    // rounded to integers. Fitting to the rounded width leaves the content a
    // fraction of a pixel too wide — enough to bring the horizontal scrollbar
    // back — so reserve one extra pixel whenever a classic scrollbar exists.
    if (cachedScrollbarWidth > 0) cachedScrollbarWidth += 1;
  }
  return cachedScrollbarWidth;
}
