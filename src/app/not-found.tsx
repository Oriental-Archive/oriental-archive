import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 py-24 text-center text-foreground">
      <h1 className="font-serif text-6xl text-foreground">404</h1>
      <p className="max-w-md text-base text-foreground/80">
        This page isn&apos;t in the catalog. It may have been moved, or the
        volume you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className={buttonVariants({
          variant: "secondary",
          className: "mt-2 border-gold text-burgundy hover:border-burgundy hover:bg-burgundy hover:text-background",
        })}
      >
        Return to the library
      </Link>
    </main>
  );
}
