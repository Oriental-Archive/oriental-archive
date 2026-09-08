import { prisma } from "@/lib/prisma";

// Three rows in SiteSetting rather than one per field (spec §47) — grouped
// by what's edited together in the admin UI, not one giant blob or dozens
// of single-value rows.
const DEFAULTS = {
  general: {
    announcementEnabled: false,
    announcementText: "",
    contactEmail: "",
  },
  uploadLimits: {
    maxDocumentUploadBytes: 200 * 1024 * 1024,
    maxImageUploadBytes: 10 * 1024 * 1024,
  },
  featured: {
    bookIds: [] as string[],
    readingPathIds: [] as string[],
  },
};

export type SiteSettings = typeof DEFAULTS;

export async function getSiteSettings(): Promise<SiteSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    general: { ...DEFAULTS.general, ...(byKey.get("general") as object) },
    uploadLimits: { ...DEFAULTS.uploadLimits, ...(byKey.get("uploadLimits") as object) },
    featured: { ...DEFAULTS.featured, ...(byKey.get("featured") as object) },
  };
}

type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };

export async function updateSiteSettings(partial: DeepPartial<SiteSettings>): Promise<void> {
  const current = await getSiteSettings();
  await prisma.$transaction(
    Object.entries(partial).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        create: { key, value: { ...current[key as keyof SiteSettings], ...value } },
        update: { value: { ...current[key as keyof SiteSettings], ...value } },
      })
    )
  );
}
