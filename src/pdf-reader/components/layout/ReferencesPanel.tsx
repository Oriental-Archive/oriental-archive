import { useState } from "react";
import { Copy, Check, PlugZap, BookMarked, Trash2 } from "lucide-react";
import type { CitationFields, CitationStyle, SavedCitation } from "@/pdf-reader/types";
import { CITATION_STYLE_LABELS, formatCitation } from "@/pdf-reader/lib/citation";
import { Tooltip } from "@/pdf-reader/components/common/Tooltip";

const FIELD_LABELS: [keyof CitationFields, string][] = [
  ["title", "Title"],
  ["alternativeTitle", "Alternative title"],
  ["author", "Author"],
  ["editor", "Editor"],
  ["translator", "Translator"],
  ["publisher", "Publisher"],
  ["publicationDate", "Publication date"],
  ["edition", "Edition"],
  ["volume", "Volume"],
  ["issue", "Issue"],
  ["pages", "Pages"],
  ["language", "Language"],
  ["isbn", "ISBN"],
  ["doi", "DOI"],
  ["url", "URL"],
  ["archiveId", "Archive identifier"],
];

export function ReferencesPanel({
  fields,
  onChange,
  savedCitations,
  onNavigate,
  onDeleteCitation,
}: {
  fields: CitationFields;
  onChange: (patch: Partial<CitationFields>) => void;
  savedCitations: SavedCitation[];
  onNavigate: (page: number) => void;
  onDeleteCitation: (id: string) => void;
}) {
  const [style, setStyle] = useState<CitationStyle>("chicago");
  const [copied, setCopied] = useState(false);
  const hasCore = fields.title.trim() || fields.author.trim();

  async function copyCitation() {
    await navigator.clipboard.writeText(formatCitation(style, fields));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-3">
      <div className="mb-3 rounded-md border border-border bg-background-secondary p-2.5">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
          <PlugZap size={13} />
          Reference manager
        </div>
        <p className="text-[11.5px] text-text-secondary">
          Zotero is not connected in this preview. Once Oriental Archive provides credentials, citations and
          annotations will be exportable directly to a Zotero library from here.
        </p>
        <Tooltip label="Requires a connected Zotero account">
          <button type="button" disabled className="mt-2 rounded-md bg-surface-hover px-2.5 py-1 text-xs text-text-muted opacity-60">
            Save to Zotero
          </button>
        </Tooltip>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationStyle)}
          className="flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
        >
          {(Object.keys(CITATION_STYLE_LABELS) as CitationStyle[]).map((s) => (
            <option key={s} value={s}>
              {CITATION_STYLE_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={copyCitation}
          disabled={!hasCore}
          className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-background disabled:opacity-40"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          Copy
        </button>
      </div>
      {!hasCore && <p className="mb-3 text-[11px] text-text-muted">Add at least a title or author to generate a citation.</p>}
      {hasCore && (
        <pre className="mb-4 whitespace-pre-wrap rounded-md bg-background-secondary p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary">
          {formatCitation(style, fields)}
        </pre>
      )}

      <div className="mb-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
          <BookMarked size={12} />
          Saved citations
        </p>
        {savedCitations.length === 0 ? (
          <p className="text-[11.5px] text-text-muted">
            Use &ldquo;Save citation reference&rdquo; from a selection&apos;s Cite dialog to collect citations here as you read.
          </p>
        ) : (
          <div className="space-y-1.5">
            {[...savedCitations]
              .sort((a, b) => a.page - b.page)
              .map((c) => (
                <SavedCitationRow key={c.id} citation={c} fields={fields} onNavigate={onNavigate} onDelete={onDeleteCitation} />
              ))}
          </div>
        )}
      </div>

      <p className="mb-2 text-[11px] font-medium text-text-muted">
        Bibliographic details — fill in what the archive record doesn&apos;t provide
      </p>
      <div className="space-y-2">
        {FIELD_LABELS.map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-0.5 block text-[10.5px] text-text-muted">{label}</span>
            <input
              value={fields[key]}
              onChange={(e) => onChange({ [key]: e.target.value })}
              className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SavedCitationRow({
  citation,
  fields,
  onNavigate,
  onDelete,
}: {
  citation: SavedCitation;
  fields: CitationFields;
  onNavigate: (page: number) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasCore = fields.title.trim() || fields.author.trim();
  const formatted = hasCore ? formatCitation(citation.style, fields, String(citation.page)) : `"${citation.text}" (p. ${citation.page})`;

  async function copy() {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-md border border-border p-2">
      <button type="button" onClick={() => onNavigate(citation.page)} className="block w-full text-left">
        <p className="text-[10px] text-text-muted">
          p.{citation.page} · {CITATION_STYLE_LABELS[citation.style]}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] text-text-secondary">{formatted}</p>
      </button>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={copy} className="flex items-center gap-1 text-[10.5px] text-accent">
          {copied ? <Check size={11} /> : <Copy size={11} />}
          Copy
        </button>
        <button type="button" onClick={() => onDelete(citation.id)} className="flex items-center gap-1 text-[10.5px] text-text-muted hover:text-danger">
          <Trash2 size={11} />
          Remove
        </button>
      </div>
    </div>
  );
}
