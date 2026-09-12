import { getSiteSettings } from "@/lib/site-settings";

export const metadata = { title: "Privacy — Oriental Archive" };

// Deliberately not linked from the footer yet — draft, pending review before
// it's treated as the site's actual policy. Content should stay honest about
// what the app actually does (see lib/annotation-store.ts, lib/auth.ts)
// rather than asserting compliance with any specific law; this describes
// behavior, it isn't legal advice.
const LAST_UPDATED = "September 8, 2026";

export default async function PrivacyPage() {
  const { general } = await getSiteSettings();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-12">
      <h1 className="font-serif text-3xl text-foreground">Privacy</h1>
      <p className="mt-2 text-xs text-muted">Last updated {LAST_UPDATED}.</p>

      <p className="mt-6 text-sm leading-relaxed text-foreground">
        This page describes what Oriental Archive actually stores and why, in plain terms. It isn&apos;t
        a legal document — if you need a formal compliance statement for your jurisdiction, have it
        reviewed accordingly.
      </p>

      <Section title="Accounts">
        <p>
          There is no public sign-up. If a librarian creates an account for you, we store your
          name, email address, and (if set) a username — nothing else is required. Librarians can
          see this account information and can change your role or disable your account; they
          cannot see your password.
        </p>
      </Section>

      <Section title="Bookmarks, highlights, and notes">
        <p>
          If you&apos;re signed in, the bookmarks, highlights, and notes you make while reading a
          book are stored in our database, tied to your account, so they follow you across
          devices. They are private to you — librarians do not have a way to read them.
        </p>
        <p className="mt-3">
          If you&apos;re <em>not</em> signed in, the same bookmarks and highlights are stored only
          in your own browser (using a local browser database, not a cookie) and are never sent to
          us at all. They stay on that one device and disappear if you clear your browser&apos;s
          site data.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          We use one cookie: a session cookie that keeps you signed in after you log in. It&apos;s
          required for the site to function for signed-in readers and librarians — we don&apos;t
          use advertising or analytics cookies, and there are no third-party trackers on this site.
        </p>
      </Section>

      <Section title="Book requests and issue reports">
        <p>
          Requesting a book or reporting a problem with one doesn&apos;t require an account. If you
          choose to include your name or contact information, that&apos;s stored with the request
          so a librarian can follow up — it&apos;s optional, and the request works without it.
        </p>
      </Section>

      <Section title="Private books, collections, and reading paths">
        <p>
          A librarian can share a book, collection, or reading path privately with specific
          accounts rather than publishing it. Only those accounts (and librarians) can see that it
          exists at all.
        </p>
      </Section>

      <Section title="Where things are stored">
        <p>
          Account details, reading annotations, and other site data live in our database. Uploaded
          documents and cover images live in separate file storage. Both are only reachable through
          the site&apos;s own access controls — there&apos;s no public listing of either.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          For anything about your account or data on this site,{" "}
          {general.contactEmail ? (
            <>
              contact{" "}
              <a href={`mailto:${general.contactEmail}`} className="text-burgundy underline">
                {general.contactEmail}
              </a>
              .
            </>
          ) : (
            "contact a librarian."
          )}
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="font-serif text-lg text-foreground">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
