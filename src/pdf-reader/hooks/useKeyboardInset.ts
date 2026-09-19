import { useEffect } from "react";

/**
 * On iOS the on-screen keyboard shrinks the *visual* viewport but leaves the
 * layout viewport alone, so `position: fixed; bottom: 0` controls end up
 * hidden behind the keyboard. Publish the covered height as --kb so fixed
 * bars can lift themselves above it (bottom: var(--kb)).
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    function update() {
      if (!vv) return;
      const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Ignore small differences (browser chrome collapsing) — only a real keyboard is > ~120px.
      root.style.setProperty("--kb", covered > 120 ? `${Math.round(covered)}px` : "0px");
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.setProperty("--kb", "0px");
    };
  }, []);
}
