import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { GeneralSettingsForm } from "@/components/librarian/GeneralSettingsForm";
import { UploadLimitsForm } from "@/components/librarian/UploadLimitsForm";
import { FeaturedItemsManager } from "@/components/librarian/FeaturedItemsManager";
import { FooterChurchesManager } from "@/components/librarian/FooterChurchesManager";

export default async function SiteSettingsPage() {
  const [settings, books, readingPaths, churches] = await Promise.all([
    getSiteSettings(),
    prisma.book.findMany({
      where: { visibility: "PUBLIC" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.readingPath.findMany({
      where: { visibility: "PUBLIC" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.footerChurch.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);

  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-10">
      <h1 className="font-serif text-2xl text-foreground">Site Settings</h1>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">General</h2>
        <div className="mt-3">
          <GeneralSettingsForm
            initialAnnouncementEnabled={settings.general.announcementEnabled}
            initialAnnouncementText={settings.general.announcementText}
            initialContactEmail={settings.general.contactEmail}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Upload Limits</h2>
        <div className="mt-3">
          <UploadLimitsForm
            initialMaxDocumentUploadBytes={settings.uploadLimits.maxDocumentUploadBytes}
            initialMaxImageUploadBytes={settings.uploadLimits.maxImageUploadBytes}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Featured Books</h2>
        <p className="mt-1 text-xs text-muted">Shown first on the homepage shelf, in this order.</p>
        <div className="mt-3">
          <FeaturedItemsManager
            settingsKey="bookIds"
            label="Only Public books can be featured."
            selectedIds={settings.featured.bookIds}
            allItems={books}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Featured Reading Paths</h2>
        <p className="mt-1 text-xs text-muted">Shown first on the Reading Paths page.</p>
        <div className="mt-3">
          <FeaturedItemsManager
            settingsKey="readingPathIds"
            label="Only Public reading paths can be featured."
            selectedIds={settings.featured.readingPathIds}
            allItems={readingPaths}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg text-foreground">Footer Churches</h2>
        <div className="mt-3">
          <FooterChurchesManager churches={churches} />
        </div>
      </section>
    </main>
  );
}
