import { fileTypeFromBuffer } from "file-type";
import { getSiteSettings } from "@/lib/site-settings";

export class FileValidationError extends Error {}

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/epub+zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
]);

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ponytail: file-type sniffs the outer container format (magic bytes / zip
// structure) and stops attacks like "rename a .exe to .pdf". It does not
// deep-scan for malicious content embedded *inside* an otherwise-valid PDF/
// DOCX/EPUB (spec §34's "malicious content embedded inside PDF metadata,
// DOCX files, EPUB files" concern) — that needs an antivirus/content scanner
// wired in at the same call site once one is available; there is no such
// scanner in this environment today.
async function validate(params: {
  buffer: Buffer;
  claimedMimeType: string;
  allowed: Set<string>;
  maxBytes: number;
}): Promise<string> {
  if (params.buffer.byteLength === 0) {
    throw new FileValidationError("Empty file");
  }
  if (params.buffer.byteLength > params.maxBytes) {
    throw new FileValidationError(
      `File exceeds the maximum allowed size of ${params.maxBytes} bytes`
    );
  }

  const detected = await fileTypeFromBuffer(params.buffer);
  if (!detected || !params.allowed.has(detected.mime)) {
    throw new FileValidationError(
      `File content does not match an allowed type (detected: ${detected?.mime ?? "unknown"})`
    );
  }
  if (params.claimedMimeType !== detected.mime) {
    throw new FileValidationError(
      `Declared content type (${params.claimedMimeType}) does not match the file's actual content (${detected.mime})`
    );
  }

  return detected.mime;
}

export async function validateDocumentUpload(buffer: Buffer, claimedMimeType: string) {
  const { uploadLimits } = await getSiteSettings();
  return validate({
    buffer,
    claimedMimeType,
    allowed: DOCUMENT_MIME_TYPES,
    maxBytes: uploadLimits.maxDocumentUploadBytes,
  });
}

export async function validateImageUpload(buffer: Buffer, claimedMimeType: string) {
  const { uploadLimits } = await getSiteSettings();
  return validate({
    buffer,
    claimedMimeType,
    allowed: IMAGE_MIME_TYPES,
    maxBytes: uploadLimits.maxImageUploadBytes,
  });
}
