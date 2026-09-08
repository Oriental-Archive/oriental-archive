import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RequestManageForm } from "@/components/librarian/RequestManageForm";

export default async function BookRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookRequest = await prisma.bookRequest.findUnique({
    where: { id },
    include: {
      requesterUser: { select: { id: true, name: true, email: true } },
      fulfilledBook: { select: { id: true, title: true } },
    },
  });
  if (!bookRequest) notFound();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-10">
      <Link href="/librarian/requests" className="text-sm text-muted hover:text-burgundy">
        ← All requests
      </Link>

      <h1 className="mt-2 font-serif text-2xl text-foreground">{bookRequest.title}</h1>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        {bookRequest.author && <Field label="Author" value={bookRequest.author} />}
        {bookRequest.language && <Field label="Language" value={bookRequest.language} />}
        {bookRequest.churchTradition && <Field label="Church Tradition" value={bookRequest.churchTradition} />}
        {bookRequest.sourceLink && (
          <Field
            label="Link/Source"
            value={
              <a href={bookRequest.sourceLink} className="text-burgundy underline" target="_blank" rel="noreferrer">
                {bookRequest.sourceLink}
              </a>
            }
          />
        )}
        {bookRequest.reason && <Field label="Reason" value={bookRequest.reason} />}
        {bookRequest.comments && <Field label="Comments" value={bookRequest.comments} />}
        <Field
          label="Requester"
          value={
            bookRequest.requesterUser
              ? `${bookRequest.requesterUser.name} (${bookRequest.requesterUser.email})`
              : bookRequest.requesterName ?? "Anonymous"
          }
        />
        {bookRequest.requesterContact && <Field label="Contact" value={bookRequest.requesterContact} />}
        <Field label="Submitted" value={bookRequest.createdAt.toLocaleString()} />
        {bookRequest.fulfilledBook && (
          <Field
            label="Fulfilled by"
            value={
              <Link href={`/books/${bookRequest.fulfilledBook.id}`} className="text-burgundy underline">
                {bookRequest.fulfilledBook.title}
              </Link>
            }
          />
        )}
      </dl>

      <div className="mt-8">
        <RequestManageForm
          requestId={bookRequest.id}
          initialStatus={bookRequest.status}
          initialNotes={bookRequest.internalNotes ?? ""}
        />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </>
  );
}
