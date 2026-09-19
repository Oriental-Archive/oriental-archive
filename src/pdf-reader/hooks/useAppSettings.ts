import { useEffect, useState } from "react";
import type { HighlightColor, PageAnimation, PdfAppearance, ReadingMode, SpreadMode, ThemePreference, ZoomMode } from "@/pdf-reader/types";

// App-wide preferences (as opposed to per-document reading state in
// documentStore.ts): these apply the same way regardless of which document
// is open, so they live under one global key instead of per-document.
export type AppSettings = {
  defaultZoomMode: ZoomMode;
  /** Doubles as "last used" — changing the highlight color anywhere updates it, so the next highlight starts with the color you last chose. */
  defaultHighlightColor: HighlightColor;
  pdfAppearance: PdfAppearance;
  rememberLastPosition: boolean;
  smoothScrolling: boolean;
  readingMode: ReadingMode;
  spread: SpreadMode;
  pageAnimation: PageAnimation;
  theme: ThemePreference;
  /** Page-turn mode: tap the left/right edge of the screen to turn the page. */
  edgeTaps: boolean;
};

const DEFAULTS: AppSettings = {
  defaultZoomMode: "fit-width",
  defaultHighlightColor: "yellow",
  pdfAppearance: "original",
  rememberLastPosition: true,
  smoothScrolling: true,
  readingMode: "scroll",
  spread: "auto",
  pageAnimation: "on",
  theme: "light",
  edgeTaps: true,
};

const KEY = "oriental-archive:reader:settings";

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Blocked or full storage (some private-browsing modes): preferences just don't persist.
    }
  }, [settings]);

  function update(patch: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  return { settings, update };
}
