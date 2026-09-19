"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BookshelfBook } from "@/lib/bookshelf";
import { BookCoverPlaceholder } from "@/components/BookCoverPlaceholder";

const ITEM_WIDTH_PX = 168; // 9.5rem (w-38) cover + 1rem (gap-4) gap, kept in sync with the CSS below

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The homepage's discovery surface (spec §2) — a continuous shelf, not the
// only way to find a book (the Catalog page covers full search/filter).
// Loads covers a page at a time as the visitor scrolls toward the end
// (spec §46: never ship the whole library to the browser), and loops back
// to the beginning instead of stopping at a hard edge once the real catalog
// is exhausted.
export function Bookshelf(props: { initialBooks: BookshelfBook[]; initialCursor: string | null }) {
  const [books, setBooks] = useState(props.initialBooks);
  const [empty, setEmpty] = useState(props.initialBooks.length === 0);
  const cursorRef = useRef(props.initialCursor);
  const loadingRef = useRef(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || empty) return;
    loadingRef.current = true;
    try {
      const qs = cursorRef.current ? `?cursor=${encodeURIComponent(cursorRef.current)}` : "";
      const res = await fetch(`/api/bookshelf${qs}`);
      if (!res.ok) return;
      const data: { books: BookshelfBook[]; nextCursor: string | null } = await res.json();
      if (data.books.length === 0) {
        setEmpty(true);
        return;
      }
      setBooks((prev) => [...prev, ...data.books]);
      // A null nextCursor means we've reached the real end of the catalog —
      // loop by resetting to the beginning instead of stopping.
      cursorRef.current = data.nextCursor;
    } finally {
      loadingRef.current = false;
    }
  }, [empty]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root: scrollerRef.current, rootMargin: "0px 600px 0px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // IntersectionObserver only fires on visibility *transitions*, so a shelf
  // with too few books to fill even one screen (a small/early-stage
  // library, or a narrow viewport before the user ever scrolls) would load
  // one page and then sit there under-filled with room to spare. Keep
  // topping it up until there's enough content to actually scroll.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || empty) return;
    if (el.scrollWidth <= el.clientWidth) loadMore();
  }, [books, empty, loadMore]);

  function scrollByItems(count: number) {
    scrollerRef.current?.scrollBy({
      left: count * ITEM_WIDTH_PX,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollByItems(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollByItems(-1);
    }
  }

  // Mouse drag-to-scroll only — touch already gets native swipe scrolling,
  // and trackpad two-finger swipe already arrives as native horizontal
  // wheel scroll, so adding pointer handling for either would just fight
  // the browser's own (better) momentum scrolling.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || !scrollerRef.current) return;
    dragRef.current = { startX: e.clientX, startScrollLeft: scrollerRef.current.scrollLeft, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !scrollerRef.current) return;
    const delta = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) > 3) {
      drag.moved = true;
      // Capture only once this is really a drag. Capturing on pointerdown
      // (as this used to) makes the browser deliver the closing click to the
      // shelf instead of the book link under the cursor, so a plain click
      // on a book did nothing.
      scrollerRef.current.setPointerCapture(e.pointerId);
    }
    if (drag.moved) scrollerRef.current.scrollLeft = drag.startScrollLeft - delta;
  }

  function onPointerUp() {
    // The browser's own "click" event fires *after* this, as part of the
    // same gesture — leave the moved flag for onClickCapture to read and
    // clear, rather than resetting it here where a subsequent click could
    // never see it.
    justDraggedRef.current = dragRef.current?.moved ?? false;
    dragRef.current = null;
  }

  function onClickCapture(e: React.MouseEvent) {
    // Suppress the click that ends a drag so it doesn't also navigate.
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="relative">
      <ShelfArrow direction="left" onClick={() => scrollByItems(-3)} />
      <ShelfArrow direction="right" onClick={() => scrollByItems(3)} />

      <div
        ref={scrollerRef}
        role="list"
        aria-label="Featured books"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex cursor-grab gap-4 overflow-x-auto scroll-smooth px-12 py-6 [-ms-overflow-style:none] [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden motion-reduce:scroll-auto"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {books.map((book, i) => (
          <BookshelfItem key={`${book.id}-${i}`} book={book} />
        ))}
        <div ref={sentinelRef} aria-hidden className="w-px shrink-0" />
      </div>
    </div>
  );
}

function BookshelfItem({ book }: { book: BookshelfBook }) {
  return (
    <Link
      href={`/books/${book.id}`}
      role="listitem"
      draggable={false}
      style={{ scrollSnapAlign: "center" }}
      className="group w-38 shrink-0 select-none"
    >
      <div className="aspect-2/3 w-38 overflow-hidden rounded-sm border border-border bg-surface shadow-sm transition-all group-hover:-translate-y-1 group-hover:border-gold group-hover:shadow-md group-focus-visible:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {book.coverImageStorageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/books/${book.id}/file?type=cover&mode=read`}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookCoverPlaceholder title={book.title} author={book.author} tradition={book.churchTradition.label} />
        )}
      </div>
      <p dir="auto" className="mt-2 line-clamp-2 text-center font-serif text-xs text-foreground group-hover:text-burgundy">
        {book.title}
      </p>
    </Link>
  );
}

function ShelfArrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Scroll shelf left" : "Scroll shelf right"}
      className={`absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-sm border border-border bg-background text-navy hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
        direction === "left" ? "left-0" : "right-0"
      }`}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}
