# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Start dev server (Webpack — do NOT use Turbopack; it has a Chinese-path bug in Next.js 16)
npm run build      # Production build
npm run migrate    # Seed DB from reference/星光🌟超級表格總表-啟鴻.xlsx (one-time; requires env vars)
```

No test runner is configured.

## Environment

Copy `.env.local.example` to `.env.local`. Three variables are required:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used client-side and in Server Components
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; bypasses RLS for API routes

## Architecture

This is a Next.js 16 App Router app (Webpack mode). The single page at `/students` is auth-gated: the Server Component checks the session and redirects to `/login` if unauthenticated; the actual UI is a Client Component (`StudentsClient.tsx`).

### Data flow

**Reading:** `useStudents` hook (SWR + Supabase JS client, anon key) queries the `students` table with filters and pagination. Cell edits are optimistic-updated via `updateCell`.

**Import pipeline (xlsx → DB):**
1. `POST /api/import` — parses the uploaded xlsx with ExcelJS (`lib/import/parseXlsx.ts`), transforms each row to `StudentInsert` (`lib/import/transform.ts`), queries existing students in 500-ID chunks, computes field-level diffs (`lib/import/diff.ts`), and stores the **full `importRows` array** in `import_sessions.diff_snapshot` (JSONB). Returns preview diffs (first 1000) + stats to the frontend.
2. `POST /api/import/apply` — reads `importRows` back from `diff_snapshot`, upserts in batches of 100.

> **Important:** `diff_snapshot` stores `StudentInsert[]` (not `FieldDiff[]`) so the apply step has all required fields. The preview diffs shown in the UI are computed at upload time and returned in the response body only — they are **not** what is stored in the DB.

**Export:** `GET /api/export` fetches all students matching filters and streams an xlsx built by `lib/export/buildXlsx.ts`.

### xlsx column mapping

`lib/import/transform.ts` maps the source xlsx (學員關懷傘下學員報課狀況.xlsx) by 1-based column index. After ExcelJS `row.values.slice(1)`, the array becomes 0-indexed, and `get(col)` returns `row[col - 1]`. The student `id` comes from column 1 (系統編號) directly, not from parsing the name.

### Key types (`lib/supabase/types.ts`)

- `Student` — DB row (includes computed `name_with_id`)
- `StudentInsert` — `Omit<Student, 'name_with_id' | 'created_at' | 'updated_at'>`
- `ImportSession` — `import_sessions` table row; `diff_snapshot` is typed as `FieldDiff[] | null` but actually stores `StudentInsert[]` at runtime

### State management

`useStudentStore` (Zustand) holds: active tab (`星光` / `太陽`), filter values, current page, and import modal open state. Changing tab or any filter resets page to 0.

### Database schema

Schema lives in `supabase/migrations/001_schema.sql`. Apply it via the Supabase dashboard SQL Editor if the tables don't exist. RLS is enabled on both tables; the service role key bypasses it for API routes, while the anon key relies on Supabase Auth for the client-side queries.
