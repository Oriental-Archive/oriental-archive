import type { DocumentMetadata } from "@/pdf-reader/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="border-b border-border/60 py-2">
      <p className="text-[10.5px] text-text-muted">{label}</p>
      <p className="text-[13px] text-text-primary">{value}</p>
    </div>
  );
}

export function DocumentInfoPanel({ metadata }: { metadata: DocumentMetadata }) {
  return (
    <div className="h-full overflow-auto p-3">
      <Row label="Title" value={metadata.title ?? metadata.fileName} />
      <Row label="Author" value={metadata.author} />
      <Row label="Subject" value={metadata.subject} />
      <Row label="Keywords" value={metadata.keywords} />
      <Row label="Creator application" value={metadata.creator} />
      <Row label="Producer" value={metadata.producer} />
      <Row label="Created" value={metadata.creationDate} />
      <Row label="Modified" value={metadata.modificationDate} />
      <Row label="Language" value={metadata.language} />
      <Row label="Pages" value={String(metadata.pageCount)} />
      <Row label="File name" value={metadata.fileName} />
      {metadata.fileSize > 0 && <Row label="File size" value={formatBytes(metadata.fileSize)} />}
    </div>
  );
}
