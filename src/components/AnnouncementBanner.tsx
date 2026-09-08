import { getSiteSettings } from "@/lib/site-settings";

export async function AnnouncementBanner() {
  const { general } = await getSiteSettings();
  if (!general.announcementEnabled || !general.announcementText) return null;

  return (
    <div className="bg-navy px-6 py-2 text-center text-sm text-background">
      {general.announcementText}
    </div>
  );
}
