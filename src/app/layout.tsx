import type { Metadata } from "next";
import { Geist, Geist_Mono, Spectral } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The app's one display/editorial typeface — every `font-serif` class in the
// app (headings, book titles, the wordmark) was previously falling back to
// the browser's generic serif (Georgia/Times) because no --font-serif was
// ever defined. Spectral was designed specifically for long-form reading on
// screen, which matches this app's actual content better than a decorative
// display serif would.
const spectral = Spectral({
  variable: "--font-spectral",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrientalCodex",
  description: "A digital library for Oriental Orthodox literature.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AnnouncementBanner />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
