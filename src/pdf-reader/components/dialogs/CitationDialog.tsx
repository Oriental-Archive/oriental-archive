import { useState } from "react";
import { Modal } from "@/pdf-reader/components/common/Modal";
import type { CitationFields, CitationStyle } from "@/pdf-reader/types";
import { CITATION_STYLE_LABELS, formatCitation, formatInTextCitation } from "@/pdf-reader/lib/citation";

export function CitationDialog({
  page,
  text,
  fields,
  onClose,
  onSaveToNotes,
  onSaveReference,
}: {
  page: number;
  text: string;
  fields: CitationFields;
  onClose: () => void;
  onSaveToNotes: (content: string) => void;
  /** Keeps a structured (page + style) reference outside any note — distinct from folding the quote into note prose. */
  onSaveReference: (style: CitationStyle) => void;
}) {
  const [style, setStyle] = useState<CitationStyle>("chicago");
  const hasMetadata = fields.title.trim() || fields.author.trim();
  const inText = formatInTextCitation(fields, String(page));
  const bibliography = hasMetadata ? formatCitation(style, fields, String(page)) : null;

  async function copy(content: string) {
    await navigator.clipboard.writeText(content);
  }

  return (
    <Modal title="Create citation" onClose={onClose} width={440}>
      {!hasMetadata && (
        <p className="mb-3 rounded-md bg-warning/10 p-2 text-[12px] text-warning">
          No bibliographic metadata is set for this document yet — add it under References to generate a full
          citation. You can still copy the quote or an in-text reference below.
        </p>
      )}
      <blockquote className="mb-3 rounded-md bg-background-secondary p-2.5 text-[13px] italic text-text-secondary">
        &ldquo;{text}&rdquo;
      </blockquote>

      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] text-text-muted">Citation style</span>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationStyle)}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
        >
          {(Object.keys(CITATION_STYLE_LABELS) as CitationStyle[]).map((s) => (
            <option key={s} value={s}>
              {CITATION_STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <ActionRow label="Copy quote" onClick={() => copy(text)} />
        <ActionRow label={`Copy quote + citation ${inText}`} onClick={() => copy(`"${text}" ${inText}`)} />
        <ActionRow label="Copy footnote citation" onClick={() => copy(bibliography ?? inText)} disabled={!bibliography} />
        <ActionRow label="Copy bibliography entry" onClick={() => copy(bibliography ?? "")} disabled={!bibliography} />
        <ActionRow
          label="Save quote + citation to notes"
          onClick={() => {
            onSaveToNotes(`> "${text}" ${inText}`);
            onClose();
          }}
        />
        <ActionRow
          label="Save citation reference"
          onClick={() => {
            onSaveReference(style);
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}

function ActionRow({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block w-full rounded-md border border-border px-3 py-2 text-left text-[12.5px] text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {label}
    </button>
  );
}
