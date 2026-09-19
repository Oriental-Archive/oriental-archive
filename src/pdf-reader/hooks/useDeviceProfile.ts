import { useEffect, useState } from "react";

export type FormFactor = "phone" | "tablet" | "desktop";

export type DeviceProfile = {
  form: FormFactor;
  /** Primary input is a finger (not a mouse) — sizes touch targets and picks tap-vs-hover behavior. */
  touch: boolean;
  landscape: boolean;
  width: number;
  height: number;
  reducedMotion: boolean;
};

/**
 * Classifies by *interaction model*, not just width: a landscape phone is
 * 850px wide but still a phone (one thumb, no room for chrome), so the short
 * side decides for touch devices. Width alone still rules for mouse windows,
 * so a narrow desktop window gets the same touch-first layout it would on a
 * phone rather than a squeezed desktop toolbar.
 */
export function classify(width: number, height: number, touch: boolean): FormFactor {
  const short = Math.min(width, height);
  if (width < 600 || (touch && short < 600)) return "phone";
  if (width < 1024 || (touch && short < 900)) return "tablet";
  return "desktop";
}

function read(): DeviceProfile {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  return {
    form: classify(width, height, touch),
    touch,
    landscape: width > height,
    width,
    height,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>(() =>
    typeof window === "undefined"
      ? { form: "desktop", touch: false, landscape: true, width: 1280, height: 800, reducedMotion: false }
      : read()
  );

  useEffect(() => {
    const update = () => setProfile(read());
    const queries = [window.matchMedia("(pointer: coarse)"), window.matchMedia("(prefers-reduced-motion: reduce)")];
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    queries.forEach((q) => q.addEventListener("change", update));
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      queries.forEach((q) => q.removeEventListener("change", update));
    };
  }, []);

  return profile;
}
