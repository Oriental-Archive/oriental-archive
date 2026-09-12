import Link from "next/link";
import { HeroSearch } from "@/components/home/HeroSearch";
import { BookCoverPlaceholder } from "@/components/BookCoverPlaceholder";
import { Logo } from "@/components/Logo";
import type { BookshelfBook } from "@/lib/bookshelf";

// Asymmetric masthead (spec: reject "a giant centered serif headline that
// dominates the page") — copy and search on the left, a staggered stack of
// real covers on the right instead of a decorative/invented illustration
// (spec §17: "make the design visually interesting using actual library
// information").
export function Hero({ books }: { books: BookshelfBook[] }) {
  const spread = books.slice(0, 3);

  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-20">
        <div className="max-w-xl">
          <Logo size="hero" linkToHome={false} className="mb-6" />
          <p className="text-xs tracking-[0.14em] text-burgundy uppercase">
            An Oriental Orthodox Digital Library
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-[1.1] text-navy sm:text-5xl">
            Oriental Orthodox literature, preserved for study.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            Oriental Archive gathers theological writings, patristic works, liturgical texts,
            hagiography, and history from across the Oriental Orthodox tradition, held in one
            reading room.
          </p>
          <div className="mt-8">
            <HeroSearch />
          </div>
          <p className="mt-4 text-sm text-foreground">
            <Link href="/reading-paths" className="border-b border-navy/30 pb-0.5 hover:border-burgundy hover:text-burgundy">
              Or start with a guided reading path
            </Link>
          </p>
        </div>

        {spread.length > 0 && (
          <div className="relative mx-auto hidden h-80 w-full max-w-sm md:block" aria-hidden>
            {spread.map((book, i) => (
              <div
                key={book.id}
                className="absolute aspect-2/3 w-40 overflow-hidden rounded-sm border border-border bg-surface shadow-md"
                style={{
                  top: i * 28,
                  left: i * 64,
                  zIndex: spread.length - i,
                  transform: `rotate(${(i - 1) * 3}deg)`,
                }}
              >
                {book.coverImageStorageKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/books/${book.id}/file?type=cover&mode=read`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookCoverPlaceholder title={book.title} author={book.author} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
