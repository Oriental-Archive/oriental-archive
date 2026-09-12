# Oriental Archive

A digital library for Oriental Orthodox theological texts — patristics, liturgical works, and church history — with a public catalog, an in-browser reader, and a librarian admin area for managing the collection.

## Features

- **Catalog** — browse and search books by language, church tradition, category, document type, topic, and church fathers/saints.
- **Reader** — read PDF, EPUB, and DOCX books directly in the browser, with highlights, bookmarks, and full-text search. Highlights/notes are saved to the database for signed-in readers and to local `IndexedDB` for anonymous ones.
- **Collections & reading paths** — curated, ordered sequences of books with cover images and explanatory notes per step.
- **Book requests & issue reports** — visitors can request a book be added or flag a problem with an existing one.
- **Private access** — books, collections, and reading paths can be restricted, returning an opaque "not found" instead of a distinguishable "forbidden" response so private content can't be enumerated.
- **Librarian admin area** — manage books, versions/uploads, collections, reading paths, accounts, controlled vocabulary (languages, traditions, categories, etc.), site settings, and an audit log.
- **Auth** — email/password accounts via [better-auth](https://www.better-auth.com/), with two-factor authentication support.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + [React 19](https://react.dev) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- [Prisma ORM 7](https://www.prisma.io) on PostgreSQL
- [better-auth](https://www.better-auth.com/) for authentication
- S3-compatible object storage for uploaded files (MinIO locally, AWS S3/Cloudflare R2 in production)
- `pdfjs-dist` / `epubjs` / `mammoth` for in-browser PDF, EPUB, and DOCX rendering

## Getting started

### 1. Prerequisites

- Node.js 20+
- Docker (for local Postgres + MinIO), or your own Postgres and S3-compatible storage

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` — at minimum a real `DATABASE_URL`, a generated `BETTER_AUTH_SECRET` (`npx @better-auth/cli secret`), and storage credentials. See the comments in `.env.example` for details.

### 3. Start Postgres and object storage

```bash
docker-compose up -d
```

### 4. Install dependencies and set up the database

```bash
npm install
npm run db:migrate
npm run seed:master-librarian
npm run seed:vocabulary
```

`seed:master-librarian` creates the one protected admin account (from the `MASTER_LIBRARIAN_*` values in `.env`) used to sign in and manage the site; `seed:vocabulary` seeds the controlled terms (languages, church traditions, etc.) used throughout the catalog.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with the Master Librarian account and go to `/librarian` to manage content.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / start |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Apply migrations in development |
| `npm run db:migrate:deploy` | Apply migrations in production |
| `npm run seed:master-librarian` | Create the initial admin account (one-time) |
| `npm run seed:vocabulary` | Seed controlled vocabulary terms |
| `npm run verify:master-librarian` | Sanity-check the Master Librarian protections |
| `npm run verify:private-book-access` | Sanity-check private-content access rules |

## Project layout

```
src/app/            Routes: public site (catalog, books, collections, reading paths, reader, privacy)
                     and librarian admin area (src/app/librarian, src/app/api/admin)
src/components/      UI components, shared by public pages, the reader, and the librarian area
src/lib/             Auth, visibility/access rules, file storage, site settings, annotation store
prisma/              Schema, migrations, and the Master Librarian seed script
scripts/             One-off admin/verification scripts (run with tsx)
```
