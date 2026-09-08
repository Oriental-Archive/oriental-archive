import fs from "node:fs";
import path from "node:path";

// The six sister churches of the Oriental Orthodox communion — a fixed,
// doctrinal list rather than admin-editable content (unlike the librarian's
// separate FooterChurch table, which is for arbitrary partner links). Each
// entry names an asset slug; the actual artwork is supplied separately (see
// findChurchLogo) since no official logo files ship with this repo.
export const ORIENTAL_ORTHODOX_CHURCHES = [
  { slug: "coptic-orthodox-alexandria", name: "Coptic Orthodox Church of Alexandria", monogram: "C" },
  { slug: "syriac-orthodox-antioch", name: "Syriac Orthodox Church of Antioch", monogram: "S" },
  { slug: "armenian-apostolic", name: "Armenian Apostolic Church", monogram: "A" },
  { slug: "ethiopian-orthodox-tewahedo", name: "Ethiopian Orthodox Tewahedo Church", monogram: "E" },
  { slug: "eritrean-orthodox-tewahedo", name: "Eritrean Orthodox Tewahedo Church", monogram: "E" },
  { slug: "malankara-orthodox-syrian", name: "Malankara Orthodox Syrian Church", monogram: "M" },
] as const;

const EXTENSIONS = ["svg", "png"];

// A librarian (or you) can drop `<slug>.svg` or `<slug>.png` into
// public/brand/churches/ at any time — no code change or redeploy of this
// function needed, since it checks the filesystem on each render.
export function findChurchLogo(slug: string): string | null {
  for (const ext of EXTENSIONS) {
    const file = path.join(process.cwd(), "public", "brand", "churches", `${slug}.${ext}`);
    if (fs.existsSync(file)) return `/brand/churches/${slug}.${ext}`;
  }
  return null;
}
