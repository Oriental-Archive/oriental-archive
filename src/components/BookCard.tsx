import Link from "next/link";
import { BookCoverPlaceholder } from "@/components/BookCoverPlaceholder";

export type BookCardData = {
  id: string;
  title: string;
  author: string | null;
  coverImageStorageKey: string | null;
  language: { label: string };
  churchTradition: { label: string };
};

// Selecting a book opens its detail page — never the file directly (spec §2:
// "Selecting a book should open its Book Detail Page rather than immediately
// opening the file").
export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Link
      href={`/books/${book.id}`}
      className="group flex flex-col gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="aspect-2/3 w-full overflow-hidden rounded-sm border border-border bg-surface shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-gold group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        {book.coverImageStorageKey ? (
          // Covers are served through an authorization-gated redirect, not a
          // static asset next/image's optimizer can fetch at build/edge time.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/books/${book.id}/file?type=cover&mode=read`}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <BookCoverPlaceholder
            title={book.title}
            author={book.author}
            tradition={book.churchTradition.label}
          />
        )}
      </div>
      <div>
        <p
          dir="auto"
          className="line-clamp-2 font-serif text-sm text-foreground transition-colors group-hover:text-burgundy"
        >
          {book.title}
        </p>
        {book.author && (
          <p dir="auto" className="line-clamp-1 text-xs text-muted">
            {book.author}
          </p>
        )}
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
          {book.churchTradition.label} · {book.language.label}
          <span
            aria-hidden
            className="translate-x-0 text-burgundy opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            →
          </span>
        </p>
      </div>
    </Link>
  );
}
