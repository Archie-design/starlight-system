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

Copy `.env.local.example` to `.env.local`. Five variables are required:
- `APP_PASSWORD` — the fixed password users enter on the login page
- `AUTH_SECRET` — a random secret stored in the session cookie to verify login state
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used client-side and in Server Components
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; bypasses RLS for API routes

## Authentication

Auth uses a fixed password stored in `APP_PASSWORD` (no Supabase Auth / Google OAuth). Flow:
1. User submits password on `/login` → `POST /api/login` verifies against `APP_PASSWORD`
2. On success, an httpOnly cookie (`sl_session`) is set to the value of `AUTH_SECRET`
3. All protected Server Component pages call `checkAuth()` from `lib/auth.ts`
4. All API routes call `checkAuth()` at the top of each handler

Supabase RLS policies allow both `anon` and `authenticated` roles (migration `009_rls_allow_anon.sql`), so the anon key works without Supabase Auth.

## Architecture

Next.js 16 App Router app (Webpack mode) with auth-gated routes:
- `/students` — main student management grid
- `/counselors` — counselor group view (9 groups, each sees their assigned students)
- `/dashboard` — aggregated stats and charts (Server Component, fetches all data server-side)
- `/history` — import history log

All protected pages follow the same pattern: a Server Component (`page.tsx`) calls `checkAuth()` and redirects to `/login` if not authenticated, then renders a Client Component wrapped in `<SWRConfig revalidateOnFocus={false}>`.

### Data flow

**Reading:** `useStudents` (SWR + Supabase JS client, anon key) queries the `students` table with filters and pagination. `useCounselorStudents` does the same but filtered by `group_leader`. Cell edits are optimistic-updated via `updateCell`.

**Import pipeline (xlsx → DB):**
1. `POST /api/import` — parses xlsx with ExcelJS (`lib/import/parseXlsx.ts`), transforms rows to `StudentInsert` (`lib/import/transform.ts`), queries existing students in 500-ID chunks, computes field-level diffs (`lib/import/diff.ts`), stores the **full `importRows` array** in `import_sessions.diff_snapshot` (JSONB). Returns preview diffs (first 1000) + stats.
2. `POST /api/import/apply` — reads `importRows` from `diff_snapshot`, runs `buildGroupAssignments()` to auto-assign `group_leader`, upserts in batches of 100.

> **Critical:** `diff_snapshot` stores `StudentInsert[]` (not `FieldDiff[]`) so the apply step has all required fields. The preview diffs shown in the UI are computed at upload time, returned in the response body, and **not** stored in the DB.

**Export:** `GET /api/export` streams an xlsx built by `lib/export/buildXlsx.ts`.

### xlsx column mapping

`lib/import/transform.ts` maps source columns by 1-based index (`DEFAULT_COL`). After ExcelJS `row.values.slice(1)` the array becomes 0-indexed; `get(col)` returns `row[col - 1]`. The student `id` comes from `SYSTEM_ID` (col 2), not from parsing the name field. Dynamic header detection uses `HEADER_TO_COL_KEY` to override defaults when column positions shift.

### Counselor group assignment (`lib/import/assignGroup.ts`)

`buildGroupAssignments()` maps every student to a group by traversing upward through the `counselor` field chain (priority), then the `introducer` field chain (fallback), until it hits a `root_student_id` defined in the `counselor_groups` table (max 25 hops). The field value format is `"ID_姓名"` — parsed via `parseNameWithId()` in `lib/utils/nameUtils.ts`.

There are 9 counselor groups seeded in `supabase/migrations/003_counselor_groups.sql`. Backfill via `POST /api/counselor-groups/backfill` (paginates all students in 1000-row pages to bypass Supabase's default limit).

Two override mechanisms exist:
- `parent_aliases` table — remaps a student's upline to a proxy (e.g. when the original upline is inactive)
- `student_overrides` table — force-assigns a specific student to a given upline, bypassing the chain traversal entirely

### Key types (`lib/supabase/types.ts`)

- `Student` — full DB row (includes computed `name_with_id`)
- `StudentInsert` — `Omit<Student, 'name_with_id' | 'created_at' | 'updated_at' | 'group_leader'>` — `group_leader` is excluded because it is computed during apply, not sourced from xlsx
- `CounselorGroup` — `counselor_groups` table row with `root_student_ids: number[]`

### State management

- `useStudentStore` (Zustand, `store/useStudentStore.ts`) — active tab, filters, page, import/new-student modal open state, column visibility, view mode (`grid` | `org`). Tab or filter change resets page to 0.
- `useCounselorStore` (Zustand, `store/useCounselorStore.ts`) — active group, filters, page, column visibility. Group or filter change resets page to 0.

Both stores are client-only (`'use client'`). URL filter sync is handled separately in `FilterBar.tsx` via `useSearchParams`.

### Database schema

Migrations in `supabase/migrations/` (apply in order via Supabase SQL Editor):
- `001_schema.sql` — `students` and `import_sessions` tables, RLS policies
- `002_import_logs.sql` — `import_logs` table
- `003_counselor_groups.sql` — `counselor_groups` table + `students.group_leader` column + 9 initial groups
- `004_spirit_ambassador_fields.sql` — `spirit_ambassador_join_date`, `love_giving_start_date`, `spirit_ambassador_group`, `cumulative_seniority` columns
- `005_edit_logs.sql` — `edit_logs` table for manual edit audit trail
- `006_parent_aliases.sql` — `parent_aliases` table for proxy upline relationships
- `007_student_overrides.sql` — `student_overrides` table for force-assigned upline exceptions
- `008_birthday_field.sql` — `birthday` column on `students`
- `009_rls_allow_anon.sql` — updates all RLS policies to allow `anon` role (required after removing Supabase Auth)

Service role key bypasses RLS for all API routes; anon key is used for client-side queries (allowed by migration 009).

### Adding a new xlsx column

1. Add the 1-based column index to `DEFAULT_COL` in `lib/import/transform.ts`
2. Add the Chinese header string to `HEADER_TO_COL_KEY`
3. Add the field to the `return` object in `transformSourceRow()` (use `normalizeDate()` for date fields)
4. Add the field to `Student` interface in `lib/supabase/types.ts`
5. Create a new migration `ALTER TABLE students ADD COLUMN IF NOT EXISTS ...`
6. Add a column definition to `components/StudentGrid/columns.tsx`
7. Add the col to `COLUMN_GROUPS` in `components/StudentGrid/Toolbar.tsx` and `components/CounselorsLayout/index.tsx`
