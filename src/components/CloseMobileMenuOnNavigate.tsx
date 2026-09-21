"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function closeMenu() {
  const toggle = document.getElementById("nav-toggle") as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
}

// SiteHeader's mobile menu is a CSS-only checkbox toggle, and the header lives
// in the root layout, which stays mounted while pages change — so navigating
// never reset the checkbox and the menu stayed open over the new page. This
// closes it on any route change (including back/forward), and on a tap of a
// menu link, which also covers tapping the link for the page you're already on
// (no route change, but the menu should still get out of the way).
export function CloseMobileMenuOnNavigate() {
  const pathname = usePathname();

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if ((e.target as Element).closest("#mobile-nav a, #mobile-nav button")) closeMenu();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
