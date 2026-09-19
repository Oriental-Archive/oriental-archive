import type { Annotation } from "@/pdf-reader/types";

export type ExportFormat = "markdown" | "plaintext" | "json" | "csv";

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function exportAnnotations(annotations: Annotation[], format: ExportFormat, documentTitle: string): string {
  const sorted = [...annotations].sort((a, b) => a.page - b.page);

  switch (format) {
    case "json":
      return JSON.stringify(sorted, null, 2);

    case "csv": {
      const header = ["page", "type", "color", "text", "comment", "tags", "createdAt"].join(",");
      const rows = sorted.map((a) =>
        [
          String(a.page),
          a.type,
          a.color,
          csvCell(a.selectedText ?? ""),
          csvCell(a.comment),
          csvCell(a.tags.join("; ")),
          a.createdAt,
        ].join(",")
      );
      return [header, ...rows].join("\n");
    }

    case "markdown": {
      const lines = [`# Annotations — ${documentTitle}`, ""];
      for (const a of sorted) {
        lines.push(`## Page ${a.page} — ${a.type}${a.tags.length ? ` (${a.tags.join(", ")})` : ""}`);
        if (a.selectedText) lines.push(`> ${a.selectedText}`);
        if (a.comment) lines.push("", a.comment);
        lines.push("");
      }
      return lines.join("\n");
    }

    case "plaintext": {
      const lines: string[] = [];
      for (const a of sorted) {
        lines.push(`p.${a.page} [${a.type}]`);
        if (a.selectedText) lines.push(`"${a.selectedText}"`);
        if (a.comment) lines.push(a.comment);
        lines.push("");
      }
      return lines.join("\n");
    }
  }
}

export function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  markdown: "text/markdown",
  plaintext: "text/plain",
  json: "application/json",
  csv: "text/csv",
};

export const EXPORT_EXTENSION: Record<ExportFormat, string> = {
  markdown: "md",
  plaintext: "txt",
  json: "json",
  csv: "csv",
};
