import type { CitationFields, CitationStyle } from "@/pdf-reader/types";

// Pure formatting: every function below only arranges fields the caller
// supplies. Missing fields are omitted rather than guessed, so a citation
// string never contains invented bibliographic data. Adding a style is
// adding one function to STYLE_FORMATTERS, not touching call sites.

function authorLastFirst(author: string): string {
  const parts = author.trim().split(/\s+/);
  if (parts.length < 2) return author;
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(" ");
  return `${last}, ${rest}`;
}

function year(fields: CitationFields): string {
  const match = fields.publicationDate.match(/\d{4}/);
  return match ? match[0] : fields.publicationDate;
}

function chicago(fields: CitationFields, page?: string): string {
  const bits: string[] = [];
  if (fields.author) bits.push(`${authorLastFirst(fields.author)}.`);
  bits.push(`"${fields.title}."`);
  if (fields.publisher) bits.push(`${fields.publisher},`);
  if (fields.publicationDate) bits.push(`${year(fields)}.`);
  if (page) bits.push(`p. ${page}.`);
  return bits.join(" ");
}

function turabian(fields: CitationFields, page?: string): string {
  // Turabian's notes-bibliography style is Chicago-derived; the visible
  // difference for a single-work citation like this is negligible, so this
  // reuses chicago() rather than duplicating the same field arrangement.
  return chicago(fields, page);
}

function mla(fields: CitationFields, page?: string): string {
  const bits: string[] = [];
  if (fields.author) bits.push(`${authorLastFirst(fields.author)}.`);
  bits.push(`${fields.title}.`);
  if (fields.publisher) bits.push(`${fields.publisher},`);
  if (fields.publicationDate) bits.push(`${year(fields)}.`);
  if (page) bits.push(`p. ${page}.`);
  return bits.join(" ");
}

function apa(fields: CitationFields, page?: string): string {
  const bits: string[] = [];
  if (fields.author) bits.push(`${authorLastFirst(fields.author)}`);
  if (fields.publicationDate) bits.push(`(${year(fields)}).`);
  bits.push(`${fields.title}.`);
  if (fields.publisher) bits.push(`${fields.publisher}.`);
  if (page) bits.push(`(p. ${page})`);
  return bits.join(" ").trim();
}

function bibtexKey(fields: CitationFields): string {
  const authorKey = fields.author.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z]/g, "") || "work";
  return `${authorKey}${year(fields) || ""}`;
}

function bibtex(fields: CitationFields, page?: string): string {
  const entries = Object.entries({
    title: fields.title,
    author: fields.author,
    publisher: fields.publisher,
    year: year(fields),
    edition: fields.edition,
    volume: fields.volume,
    isbn: fields.isbn,
    doi: fields.doi,
    url: fields.url,
    language: fields.language,
    note: page ? `p. ${page}` : "",
  }).filter(([, v]) => v);
  const body = entries.map(([k, v]) => `  ${k} = {${v}}`).join(",\n");
  return `@book{${bibtexKey(fields)},\n${body}\n}`;
}

function ris(fields: CitationFields, page?: string): string {
  const lines: string[] = ["TY  - BOOK"];
  if (fields.title) lines.push(`TI  - ${fields.title}`);
  if (fields.author) lines.push(`AU  - ${authorLastFirst(fields.author)}`);
  if (fields.publisher) lines.push(`PB  - ${fields.publisher}`);
  if (fields.publicationDate) lines.push(`PY  - ${year(fields)}`);
  if (fields.isbn) lines.push(`SN  - ${fields.isbn}`);
  if (fields.doi) lines.push(`DO  - ${fields.doi}`);
  if (fields.url) lines.push(`UR  - ${fields.url}`);
  if (fields.language) lines.push(`LA  - ${fields.language}`);
  if (page) lines.push(`N1  - p. ${page}`);
  lines.push("ER  - ");
  return lines.join("\n");
}

const STYLE_FORMATTERS: Record<CitationStyle, (fields: CitationFields, page?: string) => string> = {
  chicago,
  turabian,
  mla,
  apa,
  bibtex,
  ris,
};

export function formatCitation(style: CitationStyle, fields: CitationFields, page?: string): string {
  return STYLE_FORMATTERS[style](fields, page);
}

export function formatInTextCitation(fields: CitationFields, page: string): string {
  const author = fields.author ? fields.author.split(/\s+/).pop() : null;
  if (author) return `(${author}, p. ${page})`;
  if (fields.title) return `(${fields.title}, p. ${page})`;
  return `(p. ${page})`;
}

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  chicago: "Chicago",
  mla: "MLA",
  apa: "APA",
  turabian: "Turabian",
  bibtex: "BibTeX",
  ris: "RIS",
};

export function emptyCitationFields(): CitationFields {
  return {
    title: "",
    alternativeTitle: "",
    author: "",
    editor: "",
    translator: "",
    publisher: "",
    publicationDate: "",
    edition: "",
    volume: "",
    issue: "",
    pages: "",
    language: "",
    isbn: "",
    doi: "",
    url: "",
    archiveId: "",
  };
}
