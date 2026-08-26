## Context

See proposal.md - Why for motivation. Two pieces of existing structure shape this change:

1. **Header-driven import mapping.** `lib/import/parseXlsx.ts` initializes `colMap` from `DEFAULT_COL` (fixed column indices, used only as a fallback) and then overwrites entries based on matching header text via `HEADER_TO_COL_KEY`. So as long as the source file's header text matches what's registered, actual column position doesn't matter. Cross-checking the fixed indices in `DEFAULT_COL` against the sample file `reference/學員資料庫 20260606.xlsx` showed most of them are already stale (e.g. `BIRTHDAY: 5` vs. actual column 7) — an existing, pre-dating condition, out of scope here per explicit user decision. This change only needs to add new header→key mappings; it does not need to touch the existing (already drifted) `DEFAULT_COL` fallback values for other fields.

2. **Three parallel "which columns exist" lists.** `components/StudentGrid/columns.tsx` (`studentColumns`, shared by all three grids: `/students`, `/counselors`, `/maintenance`), `lib/constants/index.ts` (`COLUMN_GROUPS`, drives the column-visibility settings panel, also shared across all three pages), and `lib/export/buildXlsx.ts` (`HEADERS`/`studentToRow()`, drives xlsx export) are maintained independently — this is a known, accepted pattern in the codebase (not something to fix here), but it means this change touches three places for one conceptual "new field."

**Naming collision already resolved with the user:** the existing `region` field (students.region, sourced from xlsx "輔導區域"/"關懷區域") is displayed in the UI as "地區" — an organizational/counseling-structure grouping, unrelated to geography. This change's new "地區" column (geographic, from xlsx column "地區" next to "縣市/州/省" and "地址") is a different concept entirely. Decision from the user: keep `region`'s existing label as "地區" untouched, and label the new field distinctly as "地區（地址）" everywhere it appears in the UI.

## Goals / Non-Goals

**Goals:**
- Capture county/district/address from xlsx import using the existing header-detection mechanism, consistent with how every other text field is imported.
- Persist these as three new nullable `students` columns.
- Show these columns as hidden by default in all three grids that share `studentColumns` (`/students`, `/counselors`, `/maintenance`), toggleable via the existing column-settings UI.
- Avoid any user-facing ambiguity between the new "地區（地址）" column and the existing "地區" (region) column.

**Non-Goals:**
- Not fixing the broader `DEFAULT_COL` staleness issue for unrelated fields (explicitly deferred by the user).
- Not reconciling the three-parallel-lists pattern (`columns.tsx` / `COLUMN_GROUPS` / `buildXlsx.ts` HEADERS) into a single source of truth — that's a separate, larger refactor (see existing P2 #20 in the code review doc for the analogous filter-whitelist case) and out of scope for a field addition.
- Not adding new filter UI beyond the standard text-filter behavior every other free-text field gets.
- Not backfilling these fields for existing students from any source other than the next xlsx import (no separate one-off migration script).

## Decisions

**1. Database column names: `county`, `district`, `address` (not `region_2`, `district_2`, or anything referencing "地區" directly).**
Using semantically distinct English names avoids the naming collision at the schema level too, not just in UI labels — makes it structurally impossible to accidentally alias the wrong field in code (`district` vs `region` are visibly different identifiers, unlike two fields that might both tempt someone to name `region`).
- Alternative considered: `region_geo` / `region_org` (rename both for symmetry). Rejected — would require renaming and re-migrating the existing `region` column too, touching every place `region` is currently used (`lib/utils/system.ts`? no — but `columns.tsx`, `Toolbar.tsx`, `COLUMN_GROUPS`, `lib/export/buildXlsx.ts`, `lib/import/transform.ts`), for a purely cosmetic gain the user did not ask for and that increases risk for no behavior change.

**2. UI labels: "縣市", "地區（地址）", "地址".**
Matches the user's explicit decision. The parenthetical "（地址）" on the district field specifically (not county or address) is because "地區" alone is the exact string already used by the existing `region` column — county ("縣市") and address ("地址") don't collide with anything existing, so they don't need a qualifier.

**3. Import: three new `HEADER_TO_COL_KEY` entries (`"縣市/州/省": "COUNTY"`, `"地區": "DISTRICT"`, `"地址": "ADDRESS"`) plus three new `DEFAULT_COL` fallback indices (13, 14, 15 — matching the sample file's actual positions, used only if header detection fails).**
Consistent with how every other field is added per the existing "Adding a new xlsx column" checklist in CLAUDE.md.
- **Risk flagged, not solved here:** the header text `"地區"` is already used as a *label* for the unrelated `region`/organizational field in the UI, but not as an *xlsx header key* in `HEADER_TO_COL_KEY` (that field's xlsx headers are `"輔導區域"`/`"關懷區域"`, not `"地區"`). So there is no actual key collision in `HEADER_TO_COL_KEY` — confirmed by reading the current map. This is worth stating explicitly since it's the kind of thing that looks dangerous at a glance.

**4. New database migration `017_student_address_fields.sql`: adds `county TEXT`, `district TEXT`, `address TEXT` to `students`, all nullable, no default, no index.**
Matches the existing pattern for optional free-text fields (e.g. `little_angel`, `dream_interpreter` have no index either). No index because these fields are not part of `SORTABLE_FIELDS`/`COLUMN_FILTER_FIELDS`' performance-sensitive paths by default in this change — see Non-Goals; if usage patterns later demand filtering/sorting at scale, that's a follow-up, same as the precedent set by the code-review's P1 #16 indexing work.

**5. Column visibility default: each of the three grid-specific Zustand stores (`useStudentStore`, `useCounselorStore`, `useMaintenanceStore`) needs its initial `columnVisibility` object to explicitly set `county: false, district: false, address: false`.**
The visibility check elsewhere in the codebase is `columnVisibility[id] !== false` — meaning a column is visible unless explicitly marked `false`. An empty `columnVisibility: {}` (today's default for all three stores) means every column defaults to visible. To get "hidden by default" for a *new* column without changing the default-visible behavior of any *existing* column, the three stores' initial state literals must each gain these three explicit `false` entries — there's no global "default hidden" flag to set once.
- Alternative considered: default all three stores' `columnVisibility` to `{}` and instead skip rendering these columns unless a URL param or feature flag is set. Rejected — inconsistent with how every other optional column already works (all controlled through the same visibility map + settings panel), and would need a second code path just for these three fields.

**6. `COLUMN_GROUPS` (`lib/constants/index.ts`): add a new group `"地理位置"` containing county/district/address, rather than folding them into the existing "組織脈絡" group.**
"組織脈絡" is about counseling-chain relationships (介紹人, 關懷員, 關懷長, etc.) — geography is a distinct concern and a separate labeled group makes the settings panel easier to scan, and avoids visually suggesting these are organizational-chain fields.

**7. Export (`lib/export/buildXlsx.ts`): include county/district/address in the exported xlsx, using the same "縣市"/"地區（地址）"/"地址" labels.**
Kept in scope (proposal.md flagged this as a decision point) — the export is meant to be a full-fidelity dump of a student's stored data, and being hidden-by-default in the grid is a *display* concern, not a data-completeness concern; a user who explicitly exports the full sheet should still get every stored field. This matches how every other currently-hidden-by-default column already behaves in the exporter (e.g. `cumulative_seniority`, `spirit_ambassador_group` are exportable regardless of grid visibility state).

## Risks / Trade-offs

- [Risk] Adding a fourth thing to keep in sync (`columns.tsx`, `COLUMN_GROUPS`, `buildXlsx.ts`, and now three stores' `columnVisibility` defaults) increases the chance a future column addition forgets one of these five touch points → Mitigation: this change documents all five touch points explicitly in tasks.md so the pattern is at least written down once; a general fix (single source of truth) is out of scope per Non-Goals, consistent with the existing accepted trade-off already documented for the filter-whitelist case (P2 #20).
- [Risk] Because `DEFAULT_COL` fallback indices for *other* fields are already stale relative to the newer sample file (see Context), a future source file reorg could also drift the *new* county/district/address columns out from under their `DEFAULT_COL` fallback (13/14/15) — but since header-text detection takes priority whenever the header matches, this only matters if a future file both moves these columns *and* changes their header text simultaneously → Mitigation: none needed beyond what already protects every other field; this is the existing, accepted level of fragility in the import system, not a new one.
- [Risk] Address data (street-level address) is more sensitive than most existing free-text fields (phone/LINE ID already exist, so this isn't a new category of PII in the table, but it is additional detail) → Mitigation: no new exposure surface is introduced — access control follows the exact same tenant-isolation and role rules already governing every other student field (RLS, `applySystemFilter`, existing grid/export auth); no new API endpoint is created by this change.

## Migration Plan

1. Add `supabase/migrations/017_student_address_fields.sql` (additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, no backfill, no destructive change).
2. User runs the migration in Supabase SQL Editor (same manual-execution pattern already used for prior migrations in this project's workflow).
3. Code changes (import mapping, types, grid columns, column-group settings, three stores' default visibility, export) can be deployed independently of the migration timing — the new columns will simply read as `null`/empty for all existing students until the next import populates them, and the app already handles `null` text fields everywhere else, so there's no ordering hazard between "migration applied" and "code deployed."
4. No rollback complexity: reverting the code change leaves three unused nullable columns in the database, which is harmless; reverting the migration (`DROP COLUMN`) is safe since nothing else depends on these columns existing.
