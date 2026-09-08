import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

// The one place the actual OrientalCodex mark (public/brand/oriental-codex-logo.png —
// cross-and-open-book emblem with wordmark, supplied as a single square lockup) gets
// rendered. Every call site asks for a pixel height and gets the image at its native
// aspect ratio via next/image's intrinsic sizing — never stretched, never cropped.
const SIZES = {
  header: 44,
  footer: 40,
  hero: 96,
} as const;

export function Logo({
  size = "header",
  linkToHome = true,
  className,
}: {
  size?: keyof typeof SIZES;
  linkToHome?: boolean;
  className?: string;
}) {
  const px = SIZES[size];
  const img = (
    <Image
      src="/brand/oriental-codex-logo.png"
      alt="OrientalCodex — an Oriental Orthodox digital library"
      width={1254}
      height={1254}
      priority={size === "header"}
      style={{ height: px, width: "auto" }}
      className={cn("shrink-0", className)}
    />
  );

  if (!linkToHome) return img;

  return (
    <Link
      href="/"
      className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="OrientalCodex home"
    >
      {img}
    </Link>
  );
}
