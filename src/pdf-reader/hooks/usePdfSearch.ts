import { useCallback, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "@/pdf-reader/lib/pdf";

export type SearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
};

export type SearchMatch = {
  page: number;
  index: number; // match offset within that page's text
  length: number;
  context: string; // surrounding text for the results list
};

type PageText = { text: string; hasText: boolean };

// Search modes beyond "exact" (semantic, annotations, library) are listed in
// the type so the panel's mode switcher has somewhere to grow, but only
// "exact" is wired to a real implementation — there is no semantic backend
// to fake here.
export type SearchMode = "exact" | "annotations";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function usePdfSearch(pdf: PDFDocumentProxy | null) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [noTextLayer, setNoTextLayer] = useState(false);
  const pageTextCache = useRef<Map<number, PageText>>(new Map());
  const runIdRef = useRef(0);

  const getPageText = useCallback(
    async (pageNumber: number): Promise<PageText> => {
      const cached = pageTextCache.current.get(pageNumber);
      if (cached) return cached;
      if (!pdf) return { text: "", hasText: false };
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => (typeof (item as { str?: unknown }).str === "string" ? (item as { str: string }).str : ""))
        .join(" ");
      const result = { text, hasText: text.trim().length > 0 };
      pageTextCache.current.set(pageNumber, result);
      return result;
    },
    [pdf]
  );

  const runSearch = useCallback(
    async (searchQuery: string) => {
      const runId = ++runIdRef.current;
      setQuery(searchQuery);
      if (!pdf || !searchQuery.trim()) {
        setMatches([]);
        return;
      }
      setSearching(true);
      const flags = options.caseSensitive ? "g" : "gi";
      const pattern = options.wholeWord ? `\\b${escapeRegExp(searchQuery)}\\b` : escapeRegExp(searchQuery);
      const re = new RegExp(pattern, flags);
      const found: SearchMatch[] = [];
      let anyText = false;

      for (let n = 1; n <= pdf.numPages; n++) {
        if (runIdRef.current !== runId) return; // a newer search superseded this one
        const { text, hasText } = await getPageText(n);
        if (hasText) anyText = true;
        for (const m of text.matchAll(re)) {
          const start = Math.max(0, (m.index ?? 0) - 40);
          const end = Math.min(text.length, (m.index ?? 0) + m[0].length + 40);
          found.push({ page: n, index: m.index ?? 0, length: m[0].length, context: text.slice(start, end) });
        }
      }
      if (runIdRef.current !== runId) return;
      setMatches(found);
      setActiveIndex(0);
      setNoTextLayer(!anyText);
      setSearching(false);
    },
    [pdf, options, getPageText]
  );

  const matchesByPage = useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    for (const m of matches) {
      const list = map.get(m.page) ?? [];
      list.push(m);
      map.set(m.page, list);
    }
    return map;
  }, [matches]);

  return {
    query,
    options,
    setOptions,
    matches,
    matchesByPage,
    activeIndex,
    setActiveIndex,
    searching,
    noTextLayer,
    runSearch,
    clear: () => {
      runIdRef.current++;
      setQuery("");
      setMatches([]);
    },
  };
}
