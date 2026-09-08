import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { IssueReportManageForm } from "@/components/librarian/IssueReportManageForm";

export default async function IssueReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.issueReport.findUnique({
    where: { id },
    include: {
      book: { select: { id: true, title: true } },
      reporterUser: { select: { name: true, email: true } },
    },
  });
  if (!report) notFound();

  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-10">
      <Link href="/librarian/issue-reports" className="text-sm text-muted hover:text-burgundy">
        ← All issue reports
      </Link>

      <h1 className="mt-2 font-serif text-2xl text-foreground">Report on {report.book.title}</h1>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <Field
          label="Book"
          value={
            <Link href={`/librarian/books/${report.book.id}`} className="text-burgundy underline">
              {report.book.title}
            </Link>
          }
        />
        <Field label="Reason" value={report.reason} />
        {report.details && <Field label="Details" value={report.details} />}
        <Field
          label="Reporter"
          value={report.reporterUser ? `${report.reporterUser.name} (${report.reporterUser.email})` : "Anonymous"}
        />
        <Field label="Submitted" value={report.createdAt.toLocaleString()} />
      </dl>

      <div className="mt-8">
        <IssueReportManageForm reportId={report.id} initialStatus={report.status} />
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
