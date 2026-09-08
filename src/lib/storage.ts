import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Works against AWS S3, Cloudflare R2, or local MinIO (docker-compose.yml) —
// anything S3-compatible. STORAGE_FORCE_PATH_STYLE=true is required for MinIO
// and most self-hosted stores; false for AWS S3/R2.
const s3 = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  region: process.env.STORAGE_REGION,
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.STORAGE_BUCKET!;

export type StoragePrefix = "originals" | "covers" | "ocr";

// Server-generated key only — never derived from a user-supplied filename, so
// there is nothing for path traversal or filename-collision attacks to act
// on (spec §34). The original filename is kept purely as display metadata in
// the database, never used to address storage.
export function generateStorageKey(prefix: StoragePrefix): string {
  return `${prefix}/${randomUUID()}`;
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      // Objects are never public; every read goes through getSignedDownloadUrl
      // after our own authorization check (spec §33 — no permanent public URLs
      // for private files, and we use the same private-by-default path for
      // public books too so there is only one access code path to audit).
    })
  );
}

export async function getSignedDownloadUrl(params: {
  key: string;
  filename: string;
  disposition?: "inline" | "attachment";
  expiresInSeconds?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ResponseContentDisposition: `${params.disposition ?? "inline"}; filename="${sanitizeForHeader(params.filename)}"`,
  });
  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 300 });
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function sanitizeForHeader(filename: string): string {
  // Strip characters that could break out of the quoted header value or
  // inject additional header directives (CRLF injection).
  return filename.replace(/["\r\n]/g, "");
}
